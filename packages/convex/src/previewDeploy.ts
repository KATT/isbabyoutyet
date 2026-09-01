import { createHash } from "node:crypto";

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

/** Baked into merge-queue Vercel builds so Vite has a Convex URL without a push. */
export const MERGE_QUEUE_PLACEHOLDER_CONVEX_URL = "https://merge-queue.invalid.convex.cloud";

const HEADS_PREFIX = "refs/heads/";
const MERGE_QUEUE_REF = /^gh-readonly-queue\/.+\/pr-\d+-[0-9a-f]+$/i;

/** Marker Vercel/GitHub put on merge-queue refs, aliases, and `github.ref`. */
export const MERGE_QUEUE_REF_MARKER = "gh-readonly-queue";

export type ConvexDeployPlan =
  | { kind: "merge-queue-web-only" }
  | { kind: "production"; writeEnv: true; seed: "seed:homepage" }
  | {
      kind: "preview-create";
      previewName: string;
      writeEnv: true;
      seed: "seed:homepage:content";
    }
  | {
      kind: "preview-recreate";
      previewName: string;
      writeEnv: true;
      seed: "seed:homepage:content";
    }
  | {
      kind: "preview-reuse";
      previewName: string;
      writeEnv: boolean;
      seed: null;
    };

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

function gitBranchFromRef(ref: string) {
  if (ref.startsWith(HEADS_PREFIX)) {
    return ref.slice(HEADS_PREFIX.length);
  }
  return ref;
}

/** GitHub merge-queue refs are unique per attempt (`…/pr-280-<sha>`). */
export function isMergeQueueGitRef(ref: string) {
  return MERGE_QUEUE_REF.test(gitBranchFromRef(ref));
}

/** Merge-queue Vercel checks only need a web build — do not push or wipe a backend. */
export function shouldPushConvexBackend(gitRef: string) {
  return !isMergeQueueGitRef(gitRef);
}

/**
 * `seed-homepage-photos` must not run for merge-queue Vercel deploys.
 * Those builds never push a Convex backend, and Vercel sets
 * `deployment.ref` to a SHA. Resolving that SHA to a PR head would
 * seed the PR preview. Actions still sets `github.ref` to
 * `refs/heads/gh-readonly-queue/…`.
 */
export function shouldSkipPreviewPhotoSeed(opts: {
  githubRef: string;
  deploymentRef: string;
  deploymentEnvironment: string;
  resolvedBranch: string | null;
}) {
  const refs = [opts.githubRef, opts.deploymentRef, opts.deploymentEnvironment];
  if (opts.resolvedBranch !== null) {
    refs.push(opts.resolvedBranch);
  }
  return refs.some((ref) => ref.includes(MERGE_QUEUE_REF_MARKER));
}

/** Vercel GitHub deployments set `ref` to a SHA, not `refs/heads/<branch>`. */
export function previewNameFromGitRef(ref: string) {
  const branch = gitBranchFromRef(ref);
  if (/^[0-9a-f]{7,40}$/i.test(branch)) {
    return null;
  }
  return branch;
}

function shouldWipePreview(opts: {
  storedFingerprint: string | null;
  currentFingerprint: string;
  previewExists: boolean;
}) {
  if (!opts.previewExists) {
    return false;
  }
  if (opts.storedFingerprint === null) {
    return false;
  }
  return opts.storedFingerprint !== opts.currentFingerprint;
}

export function planConvexDeploy(opts: {
  vercelEnv: "production" | "preview";
  gitRef: string;
  currentFingerprint: string;
  stored: { previewExists: boolean; fingerprint: string | null };
}): ConvexDeployPlan {
  if (opts.vercelEnv === "preview" && isMergeQueueGitRef(opts.gitRef)) {
    return { kind: "merge-queue-web-only" };
  }
  if (opts.vercelEnv === "production") {
    return { kind: "production", writeEnv: true, seed: "seed:homepage" };
  }
  const previewName = previewNameFromGitRef(opts.gitRef) ?? opts.gitRef;
  if (!opts.stored.previewExists) {
    return {
      kind: "preview-create",
      previewName,
      writeEnv: true,
      seed: "seed:homepage:content",
    };
  }
  if (
    shouldWipePreview({
      storedFingerprint: opts.stored.fingerprint,
      currentFingerprint: opts.currentFingerprint,
      previewExists: opts.stored.previewExists,
    })
  ) {
    return {
      kind: "preview-recreate",
      previewName,
      writeEnv: true,
      seed: "seed:homepage:content",
    };
  }
  return {
    kind: "preview-reuse",
    previewName,
    writeEnv: opts.stored.fingerprint === null,
    seed: null,
  };
}

export function describeConvexDeployPlan(plan: ConvexDeployPlan) {
  switch (plan.kind) {
    case "merge-queue-web-only":
      return "GitHub merge queue — skipping Convex push, building web app only";
    case "production":
      return "Production — deploying Convex and building the web app";
    case "preview-create":
      return `Preview is new — creating Convex preview "${plan.previewName}" (no wipe)`;
    case "preview-recreate":
      return `Schema changed — recreating Convex preview "${plan.previewName}"`;
    case "preview-reuse":
      if (plan.writeEnv) {
        return `Preview exists without a schema fingerprint — pushing functions to existing preview "${plan.previewName}" (no wipe)`;
      }
      return `Schema unchanged — pushing functions to existing preview "${plan.previewName}" (no wipe)`;
  }
}

export function convexDeployCliArgs(plan: ConvexDeployPlan) {
  switch (plan.kind) {
    case "merge-queue-web-only":
    case "production":
      return [];
    case "preview-create":
      return ["--preview-name", plan.previewName, "--preview-run", "seed:seedDemoData"];
    case "preview-recreate":
      return ["--preview-create", plan.previewName, "--preview-run", "seed:seedDemoData"];
    case "preview-reuse":
      return ["--preview-name", plan.previewName];
  }
}

/** After a start_push 408 the preview is already claimed — retry without a wipe. */
export function convexDeployRetryCliArgs(plan: ConvexDeployPlan) {
  switch (plan.kind) {
    case "merge-queue-web-only":
      return [];
    case "production":
      return [];
    case "preview-create":
    case "preview-recreate":
    case "preview-reuse":
      return ["--preview-name", plan.previewName];
  }
}

/**
 * Tiny `--cmd` so Convex `start_push` runs immediately after claim.
 * The real Vite build runs after a successful push (see deploy-convex.ts).
 */
export const CONVEX_DEPLOY_URL_CMD = "node ../../apps/web/scripts/write-convex-url.mjs";

export function convexDeployArgv(extraArgs: string[]) {
  return [
    "deploy",
    "--cmd-url-env-var-name",
    "VITE_CONVEX_URL",
    "--cmd",
    CONVEX_DEPLOY_URL_CMD,
    ...extraArgs,
  ];
}

/** `--preview-run` is skipped on retry (`isNewDeployment` is then false). */
export function convexPostPushRunFunctions(plan: ConvexDeployPlan) {
  switch (plan.kind) {
    case "merge-queue-web-only":
    case "preview-reuse":
    case "production":
      return [];
    case "preview-create":
    case "preview-recreate":
      return ["seed:seedDemoData"];
  }
}

export function convexSeedNpmScripts(plan: ConvexDeployPlan) {
  switch (plan.kind) {
    case "merge-queue-web-only":
    case "preview-reuse":
      return [];
    case "production":
      return [plan.seed];
    case "preview-create":
    case "preview-recreate":
      return [plan.seed];
  }
}

export function previewNameCliArgs(plan: ConvexDeployPlan) {
  switch (plan.kind) {
    case "merge-queue-web-only":
    case "production":
      return [];
    case "preview-create":
    case "preview-recreate":
    case "preview-reuse":
      return ["--preview-name", plan.previewName];
  }
}

export function interpretEnvGetResult(opts: { ok: boolean; stdout: string; stderr: string }) {
  if (opts.ok) {
    return { previewExists: true, fingerprint: parseEnvGetOutput(opts.stdout) };
  }
  if (/Environment variable .* not found/i.test(opts.stderr)) {
    return { previewExists: true, fingerprint: null };
  }
  return { previewExists: false, fingerprint: null };
}

/** Fresh Convex previews can hang on `start_push` for 5 minutes and 408. */
export function isConvexStartPushTimeout(output: string) {
  return /\/api\/deploy2\/start_push\s+408\b/i.test(output);
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
