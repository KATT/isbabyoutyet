import { expect, test } from "vitest";
import {
  computeSchemaFingerprint,
  interpretEnvGetResult,
  isMergeQueueGitRef,
  parseEnvGetOutput,
  previewDeployCliArgs,
  previewNameFromGitRef,
  shouldPushConvexBackend,
  shouldRecreatePreview,
  shouldWriteConvexEnv,
} from "./previewDeploy";

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

test("recreates the preview only when it is missing or the schema fingerprint changed", () => {
  expect(
    shouldRecreatePreview({
      storedFingerprint: null,
      currentFingerprint: "abc",
      previewExists: false,
    }),
  ).toBe(true);
  expect(
    shouldRecreatePreview({
      storedFingerprint: null,
      currentFingerprint: "abc",
      previewExists: true,
    }),
  ).toBe(false);
  expect(
    shouldRecreatePreview({
      storedFingerprint: "abc",
      currentFingerprint: "abc",
      previewExists: true,
    }),
  ).toBe(false);
  expect(
    shouldRecreatePreview({
      storedFingerprint: "old",
      currentFingerprint: "new",
      previewExists: true,
    }),
  ).toBe(true);
});

test("writes Convex env on production, recreate, or first fingerprint write", () => {
  expect(
    shouldWriteConvexEnv({
      isPreview: false,
      recreatePreview: false,
      storedFingerprint: null,
    }),
  ).toBe(true);
  expect(
    shouldWriteConvexEnv({
      isPreview: true,
      recreatePreview: true,
      storedFingerprint: null,
    }),
  ).toBe(true);
  expect(
    shouldWriteConvexEnv({
      isPreview: true,
      recreatePreview: false,
      storedFingerprint: null,
    }),
  ).toBe(true);
  expect(
    shouldWriteConvexEnv({
      isPreview: true,
      recreatePreview: false,
      storedFingerprint: "abc",
    }),
  ).toBe(false);
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

test("preview deploy flags wipe and seed only when recreating", () => {
  expect(previewDeployCliArgs("feat/demo", true)).toEqual([
    "--preview-create",
    "feat/demo",
    "--preview-run",
    "seed:seedDemoData",
  ]);
  expect(previewDeployCliArgs("feat/demo", false)).toEqual(["--preview-name", "feat/demo"]);
});

test("preview name comes from a branch ref, not a commit SHA", () => {
  expect(previewNameFromGitRef("refs/heads/perf/skip-convex-preview-wipe")).toBe(
    "perf/skip-convex-preview-wipe",
  );
  expect(previewNameFromGitRef("feat/demo")).toBe("feat/demo");
  expect(previewNameFromGitRef("54c61db7fcd60a732df7573671eb7777ab6b1054")).toBe(null);
});

test("merge queue refs skip the Convex push", () => {
  const queueRef = "gh-readonly-queue/main/pr-280-66b364b09c1da1f4416401a654b03c50af93f86e";
  expect(isMergeQueueGitRef(queueRef)).toBe(true);
  expect(isMergeQueueGitRef(`refs/heads/${queueRef}`)).toBe(true);
  expect(isMergeQueueGitRef("feat/demo")).toBe(false);
  expect(shouldPushConvexBackend(queueRef)).toBe(false);
  expect(shouldPushConvexBackend("feat/demo")).toBe(true);
});

test("env get parser uses the last non-empty line", () => {
  expect(parseEnvGetOutput("")).toBe(null);
  expect(parseEnvGetOutput("deadbeef\n")).toBe("deadbeef");
  expect(parseEnvGetOutput("log noise\n  abc123  \n")).toBe("abc123");
});
