import { expect, test } from "vitest";
import {
  computeSchemaFingerprint,
  CONVEX_DEPLOY_URL_CMD,
  convexDeployArgv,
  convexDeployCliArgs,
  convexDeployRetryCliArgs,
  convexSeedNpmScripts,
  describeConvexDeployPlan,
  interpretEnvGetResult,
  isConvexStartPushTimeout,
  isMergeQueueGitRef,
  parseEnvGetOutput,
  planConvexDeploy,
  previewNameCliArgs,
  previewNameFromGitRef,
  shouldPushConvexBackend,
  shouldSkipPreviewPhotoSeed,
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
  expect(
    planConvexDeploy({
      vercelEnv: "preview",
      gitRef: mergeQueueRef,
      currentFingerprint: fingerprint,
      stored: { previewExists: true, fingerprint },
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

test("creates a missing preview without a wipe", () => {
  expect(
    planConvexDeploy({
      vercelEnv: "preview",
      gitRef: previewName,
      currentFingerprint: fingerprint,
      stored: { previewExists: false, fingerprint: null },
    }),
  ).toEqual({
    kind: "preview-create",
    previewName,
    writeEnv: true,
    seed: "seed:homepage:content",
  });
});

test("recreates only when the schema fingerprint changed", () => {
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
      kind: "preview-create",
      previewName,
      writeEnv: true,
      seed: "seed:homepage:content",
    }),
  ).toBe(`Preview is new — creating Convex preview "${previewName}" (no wipe)`);
  expect(
    describeConvexDeployPlan({
      kind: "preview-recreate",
      previewName,
      writeEnv: true,
      seed: "seed:homepage:content",
    }),
  ).toBe(`Schema changed — recreating Convex preview "${previewName}"`);
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

test("deploy flags wipe only when recreating an existing preview", () => {
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
      kind: "preview-create",
      previewName: "feat/demo",
      writeEnv: true,
      seed: "seed:homepage:content",
    }),
  ).toEqual(["--preview-name", "feat/demo", "--preview-run", "seed:seedDemoData"]);
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

test("start_push 408 retries claim the preview without a wipe", () => {
  expect(convexDeployRetryCliArgs({ kind: "merge-queue-web-only" })).toEqual([]);
  expect(
    convexDeployRetryCliArgs({
      kind: "production",
      writeEnv: true,
      seed: "seed:homepage",
    }),
  ).toEqual([]);
  expect(
    convexDeployRetryCliArgs({
      kind: "preview-create",
      previewName: "feat/demo",
      writeEnv: true,
      seed: "seed:homepage:content",
    }),
  ).toEqual(["--preview-name", "feat/demo"]);
  expect(
    convexDeployRetryCliArgs({
      kind: "preview-recreate",
      previewName: "feat/demo",
      writeEnv: true,
      seed: "seed:homepage:content",
    }),
  ).toEqual(["--preview-name", "feat/demo"]);
  expect(
    convexDeployRetryCliArgs({
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
      kind: "preview-create",
      previewName: "feat/demo",
      writeEnv: true,
      seed: "seed:homepage:content",
    }),
  ).toEqual(["--preview-name", "feat/demo"]);
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
  expect(isMergeQueueGitRef("20e0607956751eeb3467f750ed8367eaa6a6338c")).toBe(false);
  expect(shouldPushConvexBackend(mergeQueueRef)).toBe(false);
  expect(shouldPushConvexBackend("feat/demo")).toBe(true);
  expect(shouldPushConvexBackend("20e0607956751eeb3467f750ed8367eaa6a6338c")).toBe(true);
});

test("feature-branch previews create without a wipe then reuse", () => {
  const branch = "cursor/skip-mq-seed-preview-7188";
  const firstDeploy = planConvexDeploy({
    vercelEnv: "preview",
    gitRef: branch,
    currentFingerprint: fingerprint,
    stored: { previewExists: false, fingerprint: null },
  });
  expect(firstDeploy).toEqual({
    kind: "preview-create",
    previewName: branch,
    writeEnv: true,
    seed: "seed:homepage:content",
  });
  expect(convexDeployCliArgs(firstDeploy)).toEqual([
    "--preview-name",
    branch,
    "--preview-run",
    "seed:seedDemoData",
  ]);

  const laterDeploy = planConvexDeploy({
    vercelEnv: "preview",
    gitRef: branch,
    currentFingerprint: fingerprint,
    stored: { previewExists: true, fingerprint },
  });
  expect(laterDeploy).toEqual({
    kind: "preview-reuse",
    previewName: branch,
    writeEnv: false,
    seed: null,
  });
  expect(convexDeployCliArgs(laterDeploy)).toEqual(["--preview-name", branch]);
  expect(previewNameCliArgs(laterDeploy)).toEqual(["--preview-name", branch]);
});

test("photo seed skips merge-queue github.ref even when deployment.ref is a SHA", () => {
  const mergeQueueGithubRef = `refs/heads/${mergeQueueRef}`;
  const deploymentSha = "20e0607956751eeb3467f750ed8367eaa6a6338c";
  expect(
    shouldSkipPreviewPhotoSeed({
      githubRef: mergeQueueGithubRef,
      deploymentRef: deploymentSha,
      deploymentEnvironment: "Preview",
      resolvedBranch: "cursor/react-compiler-lint-6a73",
    }),
  ).toBe(true);
  expect(
    shouldSkipPreviewPhotoSeed({
      githubRef: mergeQueueGithubRef,
      deploymentRef: deploymentSha,
      deploymentEnvironment: "Preview",
      resolvedBranch: null,
    }),
  ).toBe(true);
  expect(
    shouldSkipPreviewPhotoSeed({
      githubRef: "refs/heads/cursor/skip-mq-seed-preview-7188",
      deploymentRef: deploymentSha,
      deploymentEnvironment: "Preview",
      resolvedBranch: "cursor/skip-mq-seed-preview-7188",
    }),
  ).toBe(false);
});

test("env get parser uses the last non-empty line", () => {
  expect(parseEnvGetOutput("")).toBe(null);
  expect(parseEnvGetOutput("deadbeef\n")).toBe("deadbeef");
  expect(parseEnvGetOutput("log noise\n  abc123  \n")).toBe("abc123");
});

test("detects Convex start_push 408 timeouts", () => {
  expect(
    isConvexStartPushTimeout(
      "✖ Error fetching POST  https://small-bandicoot-574.convex.cloud/api/deploy2/start_push 408 Request Timeout",
    ),
  ).toBe(true);
  expect(
    isConvexStartPushTimeout(
      "✖ Error fetching POST  https://helpful-dotterel-790.convex.cloud/api/deploy2/start_push 500 Internal Server Error",
    ),
  ).toBe(false);
  expect(isConvexStartPushTimeout("✔ Deployed Convex functions")).toBe(false);
});

test("deploy argv uses a tiny --cmd so start_push is not blocked by the web build", () => {
  expect(
    convexDeployArgv(["--preview-name", "feat/demo", "--preview-run", "seed:seedDemoData"]),
  ).toEqual([
    "deploy",
    "--cmd-url-env-var-name",
    "VITE_CONVEX_URL",
    "--cmd",
    CONVEX_DEPLOY_URL_CMD,
    "--preview-name",
    "feat/demo",
    "--preview-run",
    "seed:seedDemoData",
  ]);
  expect(
    convexDeployArgv(convexDeployRetryCliArgs({
      kind: "preview-create",
      previewName: "feat/demo",
      writeEnv: true,
      seed: "seed:homepage:content",
    })),
  ).toEqual([
    "deploy",
    "--cmd-url-env-var-name",
    "VITE_CONVEX_URL",
    "--cmd",
    CONVEX_DEPLOY_URL_CMD,
    "--preview-name",
    "feat/demo",
  ]);
});

test("create and recreate seed demo login after push because retry skips --preview-run", () => {
  expect(convexSeedNpmScripts({ kind: "merge-queue-web-only" })).toEqual([]);
  expect(
    convexSeedNpmScripts({
      kind: "production",
      writeEnv: true,
      seed: "seed:homepage",
    }),
  ).toEqual(["seed:homepage"]);
  expect(
    convexSeedNpmScripts({
      kind: "preview-create",
      previewName: "feat/demo",
      writeEnv: true,
      seed: "seed:homepage:content",
    }),
  ).toEqual(["seed:demo-login", "seed:homepage:content"]);
  expect(
    convexSeedNpmScripts({
      kind: "preview-recreate",
      previewName: "feat/demo",
      writeEnv: true,
      seed: "seed:homepage:content",
    }),
  ).toEqual(["seed:demo-login", "seed:homepage:content"]);
  expect(
    convexSeedNpmScripts({
      kind: "preview-reuse",
      previewName: "feat/demo",
      writeEnv: false,
      seed: null,
    }),
  ).toEqual([]);
});
