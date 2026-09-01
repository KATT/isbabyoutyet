import { createHash } from "node:crypto";
import * as z from "zod";

/** Stored on each Convex preview so later Vercel builds can skip `--preview-create`. */
export const SCHEMA_FINGERPRINT_ENV = "PREVIEW_SCHEMA_FINGERPRINT";

/**
 * Files that define the Convex data shape. Function-only changes must not
 * appear here — otherwise every preview deploy would wipe the database.
 */
export const SCHEMA_FINGERPRINT_RELATIVE_PATHS = [
  "convex/schema.ts",
  "convex/convex.config.ts",
] as const;

export function computeSchemaFingerprint(files: ReadonlyArray<{ path: string; contents: string }>) {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(file.contents);
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function shouldRecreatePreview(
  storedFingerprint: string | null,
  currentFingerprint: string,
) {
  return storedFingerprint !== currentFingerprint;
}

export function shouldWriteConvexEnv(isPreview: boolean, recreatePreview: boolean) {
  return !isPreview || recreatePreview;
}

export function previewDeployCliArgs(branch: string, recreate: boolean) {
  if (recreate) {
    return ["--preview-create", branch, "--preview-run", "seed:seedDemoData"];
  }
  return ["--preview-name", branch];
}

const HEADS_PREFIX = "refs/heads/";
const MERGE_QUEUE_REF = /^gh-readonly-queue\/.+\/pr-(\d+)-[0-9a-f]+$/i;
const githubPullHeadSchema = z.object({
  head: z.object({
    ref: z.string().min(1),
  }),
});

function gitBranchFromRef(ref: string) {
  if (ref.startsWith(HEADS_PREFIX)) {
    return ref.slice(HEADS_PREFIX.length);
  }
  return ref;
}

/** GitHub merge-queue refs are unique per attempt (`…/pr-280-<sha>`). */
function mergeQueuePullRequestNumber(ref: string) {
  const match = MERGE_QUEUE_REF.exec(gitBranchFromRef(ref));
  if (match === null) {
    return null;
  }
  return Number(match[1]);
}

/**
 * Convex preview name for a git ref. Merge-queue refs reuse the pull
 * request head when known; otherwise they collapse to `pr-<number>` so
 * each queue attempt does not provision a new backend.
 *
 * Vercel GitHub deployments sometimes set `ref` to a SHA, not `refs/heads/<branch>`.
 */
export function previewNameFromGitRef(ref: string, pullRequestHeadRef: string | null = null) {
  const branch = gitBranchFromRef(ref);
  if (/^[0-9a-f]{7,40}$/i.test(branch)) {
    return null;
  }
  const mergeQueuePr = mergeQueuePullRequestNumber(ref);
  if (mergeQueuePr !== null) {
    if (pullRequestHeadRef !== null && pullRequestHeadRef.length > 0) {
      return pullRequestHeadRef;
    }
    return `pr-${mergeQueuePr}`;
  }
  return branch;
}

export async function resolveConvexPreviewName(opts: {
  gitRef: string;
  owner: string | null;
  repo: string | null;
  token: string | null;
  fetch: typeof globalThis.fetch;
}) {
  const mergeQueuePr = mergeQueuePullRequestNumber(opts.gitRef);
  let pullRequestHeadRef: string | null = null;
  if (mergeQueuePr !== null && opts.owner !== null && opts.repo !== null) {
    pullRequestHeadRef = await fetchPullRequestHeadRef({
      owner: opts.owner,
      repo: opts.repo,
      prNumber: mergeQueuePr,
      token: opts.token,
      fetch: opts.fetch,
    });
  }
  return previewNameFromGitRef(opts.gitRef, pullRequestHeadRef);
}

export async function fetchPullRequestHeadRef(opts: {
  owner: string;
  repo: string;
  prNumber: number;
  token: string | null;
  fetch: typeof globalThis.fetch;
}) {
  const headers = new Headers({
    Accept: "application/vnd.github+json",
  });
  if (opts.token !== null && opts.token.length > 0) {
    headers.set("Authorization", `Bearer ${opts.token}`);
  }
  let response: Response;
  try {
    response = await opts.fetch(
      `https://api.github.com/repos/${opts.owner}/${opts.repo}/pulls/${opts.prNumber}`,
      { headers },
    );
  } catch {
    return null;
  }
  if (!response.ok) {
    return null;
  }
  const parsed = githubPullHeadSchema.safeParse(await response.json());
  if (!parsed.success) {
    return null;
  }
  return parsed.data.head.ref;
}

export function parseEnvGetOutput(stdout: string) {
  const lines = stdout
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const value = lines[lines.length - 1];
  if (value === undefined) {
    return null;
  }
  return value;
}
