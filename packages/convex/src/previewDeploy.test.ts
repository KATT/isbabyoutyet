import { expect, test } from "vitest";
import {
  computeSchemaFingerprint,
  convexDeployCliArgs,
  describeConvexDeployPlan,
  interpretEnvGetResult,
  isMergeQueueGitRef,
  parseEnvGetOutput,
  planConvexDeploy,
  previewNameCliArgs,
  previewNameFromGitRef,
  shouldPushConvexBackend,
} from "./previewDeploy";

const previewName = "cursor/merge-queue-convex-preview";
const mergeQueueRef = "gh-readonly-queue/main/pr-280-66b364b09c1da1f4416401a654b03c50af93f86e";
const fingerprint = "abc123";

test("fingerprint changes when schema contents change", () => {
  const before = computeSchemaFingerprint([
    { path: "convex/schema.ts", contents: "defineSchema({ babies: defineTable({}) })" },
  ]);
  const after = computeSchemaFingerprint([
    {
      path: "convex/schema.ts",
      contents: "defineSchema({ babies: defineTable({ name: v.string() }) })",
    },
  ]);
  expect(before).not.toBe(after);
});

test("fingerprint is stable for the same files", () => {
  const files = [
    { path: "convex/schema.ts", contents: "a" },
    { path: "convex/convex.config.ts", contents: "b" },
  ];
  expect(computeSchemaFingerprint(files)).toBe(computeSchemaFingerprint(files));
});

test("plans merge-queue as web-only", () => {
  expect(
    planConvexDeploy({
      vercelEnv: "preview",
      gitRef: mergeQueueRef,
      currentFingerprint: fingerprint,
      stored: { previewExists: false, fingerprint: null },
    }),
  ).toEqual({ kind: "merge-queue-web-only" });
});

test("plans production with homepage seed", () => {
  expect(
    planConvexDeploy({
      vercelEnv: "production",
      gitRef: "main",
      currentFingerprint: fingerprint,
      stored: { previewExists: false, fingerprint: null },
    }),
  ).toEqual({
    kind: "production",
    writeEnv: true,
    seed: "seed:homepage",
  });
});

test("recreates when the preview is missing or the fingerprint changed", () => {
  expect(
    planConvexDeploy({
      vercelEnv: "preview",
      gitRef: previewName,
      currentFingerprint: fingerprint,
      stored: { previewExists: false, fingerprint: null },
    }),
  ).toEqual({
    kind: "preview-recreate",
    previewName,
    writeEnv: true,
    seed: "seed:homepage:content",
  });
  expect(
    planConvexDeploy({
      vercelEnv: "preview",
      gitRef: previewName,
      currentFingerprint: "new",
      stored: { previewExists: true, fingerprint: "old" },
    }),
  ).toEqual({
    kind: "preview-recreate",
    previewName,
    writeEnv: true,
    seed: "seed:homepage:content",
  });
});

test("reuses an existing preview when the fingerprint is missing or matches", () => {
  expect(
    planConvexDeploy({
      vercelEnv: "preview",
      gitRef: previewName,
      currentFingerprint: fingerprint,
      stored: { previewExists: true, fingerprint: null },
    }),
  ).toEqual({
    kind: "preview-reuse",
    previewName,
    writeEnv: true,
    seed: null,
  });
  expect(
    planConvexDeploy({
      vercelEnv: "preview",
      gitRef: previewName,
      currentFingerprint: fingerprint,
      stored: { previewExists: true, fingerprint },
    }),
  ).toEqual({
    kind: "preview-reuse",
    previewName,
    writeEnv: false,
    seed: null,
  });
});

test("describes reuse as a function push without a wipe", () => {
  expect(describeConvexDeployPlan({ kind: "merge-queue-web-only" })).toBe(
    "GitHub merge queue — skipping Convex push, building web app only",
  );
  expect(
    describeConvexDeployPlan({
      kind: "production",
      writeEnv: true,
      seed: "seed:homepage",
    }),
  ).toBe("Production — deploying Convex and building the web app");
  expect(
    describeConvexDeployPlan({
      kind: "preview-recreate",
      previewName,
      writeEnv: true,
      seed: "seed:homepage:content",
    }),
  ).toBe(`Schema changed or preview is new — recreating Convex preview "${previewName}"`);
  expect(
    describeConvexDeployPlan({
      kind: "preview-reuse",
      previewName,
      writeEnv: true,
      seed: null,
    }),
  ).toBe(
    `Preview exists without a schema fingerprint — pushing functions to existing preview "${previewName}" (no wipe)`,
  );
  expect(
    describeConvexDeployPlan({
      kind: "preview-reuse",
      previewName,
      writeEnv: false,
      seed: null,
    }),
  ).toBe(`Schema unchanged — pushing functions to existing preview "${previewName}" (no wipe)`);
});

test("deploy flags wipe and seed only when recreating", () => {
  expect(convexDeployCliArgs({ kind: "merge-queue-web-only" })).toEqual([]);
  expect(
    convexDeployCliArgs({
      kind: "production",
      writeEnv: true,
      seed: "seed:homepage",
    }),
  ).toEqual([]);
  expect(
    convexDeployCliArgs({
      kind: "preview-recreate",
      previewName: "feat/demo",
      writeEnv: true,
      seed: "seed:homepage:content",
    }),
  ).toEqual(["--preview-create", "feat/demo", "--preview-run", "seed:seedDemoData"]);
  expect(
    convexDeployCliArgs({
      kind: "preview-reuse",
      previewName: "feat/demo",
      writeEnv: false,
      seed: null,
    }),
  ).toEqual(["--preview-name", "feat/demo"]);
});

test("follow-up Convex CLI commands get --preview-name on preview plans", () => {
  expect(previewNameCliArgs({ kind: "merge-queue-web-only" })).toEqual([]);
  expect(
    previewNameCliArgs({
      kind: "production",
      writeEnv: true,
      seed: "seed:homepage",
    }),
  ).toEqual([]);
  expect(
    previewNameCliArgs({
      kind: "preview-recreate",
      previewName: "feat/demo",
      writeEnv: true,
      seed: "seed:homepage:content",
    }),
  ).toEqual(["--preview-name", "feat/demo"]);
  expect(
    previewNameCliArgs({
      kind: "preview-reuse",
      previewName: "feat/demo",
      writeEnv: false,
      seed: null,
    }),
  ).toEqual(["--preview-name", "feat/demo"]);
});

test("env get treats a missing variable as an existing preview", () => {
  expect(
    interpretEnvGetResult({
      ok: false,
      stdout: "",
      stderr:
        '✖ Environment variable "PREVIEW_SCHEMA_FINGERPRINT" not found (on preview deployment keen-herring-537)',
    }),
  ).toEqual({ previewExists: true, fingerprint: null });
  expect(
    interpretEnvGetResult({
      ok: false,
      stdout: "",
      stderr: "✖ Error: Preview deployment not found",
    }),
  ).toEqual({ previewExists: false, fingerprint: null });
  expect(
    interpretEnvGetResult({
      ok: true,
      stdout: "deadbeef\n",
      stderr: "",
    }),
  ).toEqual({ previewExists: true, fingerprint: "deadbeef" });
});

test("preview name comes from a branch ref, not a commit SHA", () => {
  expect(previewNameFromGitRef("refs/heads/perf/skip-convex-preview-wipe")).toBe(
    "perf/skip-convex-preview-wipe",
  );
  expect(previewNameFromGitRef("feat/demo")).toBe("feat/demo");
  expect(previewNameFromGitRef("54c61db7fcd60a732df7573671eb7777ab6b1054")).toBe(null);
});

test("merge queue refs skip the Convex push", () => {
  expect(isMergeQueueGitRef(mergeQueueRef)).toBe(true);
  expect(isMergeQueueGitRef(`refs/heads/${mergeQueueRef}`)).toBe(true);
  expect(isMergeQueueGitRef("feat/demo")).toBe(false);
  expect(shouldPushConvexBackend(mergeQueueRef)).toBe(false);
  expect(shouldPushConvexBackend("feat/demo")).toBe(true);
});

test("env get parser uses the last non-empty line", () => {
  expect(parseEnvGetOutput("")).toBe(null);
  expect(parseEnvGetOutput("deadbeef\n")).toBe("deadbeef");
  expect(parseEnvGetOutput("log noise\n  abc123  \n")).toBe("abc123");
});
