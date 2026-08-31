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

/** Vercel GitHub deployments set `ref` to a SHA, not `refs/heads/<branch>`. */
export function previewNameFromGitRef(ref: string) {
  const headsPrefix = "refs/heads/";
  if (ref.startsWith(headsPrefix)) {
    return ref.slice(headsPrefix.length);
  }
  if (/^[0-9a-f]{7,40}$/i.test(ref)) {
    return null;
  }
  return ref;
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
