import { expect, test } from "vitest";
import {
  computeSchemaFingerprint,
  fetchPullRequestHeadRef,
  parseEnvGetOutput,
  previewDeployCliArgs,
  previewNameFromGitRef,
  resolveConvexPreviewName,
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

test("recreates the preview when no fingerprint is stored yet", () => {
  expect(shouldRecreatePreview(null, "abc")).toBe(true);
});

test("reuses the preview when the schema fingerprint matches", () => {
  expect(shouldRecreatePreview("abc", "abc")).toBe(false);
});

test("recreates the preview when the schema fingerprint changed", () => {
  expect(shouldRecreatePreview("old", "new")).toBe(true);
});

test("writes Convex env on production and on preview recreate, not on reuse", () => {
  expect(shouldWriteConvexEnv(false, false)).toBe(true);
  expect(shouldWriteConvexEnv(true, true)).toBe(true);
  expect(shouldWriteConvexEnv(true, false)).toBe(false);
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

test("merge queue refs reuse the pull request head, not the unique queue branch", () => {
  const queueRef = "gh-readonly-queue/main/pr-280-66b364b09c1da1f4416401a654b03c50af93f86e";
  expect(previewNameFromGitRef(queueRef, "cursor/react-compiler-lint-6a73")).toBe(
    "cursor/react-compiler-lint-6a73",
  );
  expect(previewNameFromGitRef(`refs/heads/${queueRef}`)).toBe("pr-280");
  expect(previewNameFromGitRef("feat/demo", "cursor/ignored")).toBe("feat/demo");
});

test("GitHub pull lookup returns the head ref and sends a token when given", async () => {
  const requested: Array<{ url: string; authorization: string | null }> = [];
  const headRef = await fetchPullRequestHeadRef({
    owner: "KATTCORP",
    repo: "isbabyoutyet",
    prNumber: 280,
    token: "ghs_test",
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      requested.push({
        url: String(input),
        authorization: headers.get("authorization"),
      });
      return Response.json({ head: { ref: "cursor/react-compiler-lint-6a73" } });
    },
  });
  expect(headRef).toBe("cursor/react-compiler-lint-6a73");
  expect(requested).toEqual([
    {
      url: "https://api.github.com/repos/KATTCORP/isbabyoutyet/pulls/280",
      authorization: "Bearer ghs_test",
    },
  ]);
});

test("GitHub pull lookup returns null when the API fails", async () => {
  const headRef = await fetchPullRequestHeadRef({
    owner: "KATTCORP",
    repo: "isbabyoutyet",
    prNumber: 280,
    token: null,
    fetch: async () => new Response("Not Found", { status: 404 }),
  });
  expect(headRef).toBe(null);
});

test("merge queue preview name prefers the GitHub head and falls back to pr-N", async () => {
  const queueRef = "gh-readonly-queue/main/pr-280-66b364b09c1da1f4416401a654b03c50af93f86e";
  const reused = await resolveConvexPreviewName({
    gitRef: queueRef,
    owner: "KATTCORP",
    repo: "isbabyoutyet",
    token: null,
    fetch: async () => Response.json({ head: { ref: "cursor/react-compiler-lint-6a73" } }),
  });
  expect(reused).toBe("cursor/react-compiler-lint-6a73");

  const fallback = await resolveConvexPreviewName({
    gitRef: queueRef,
    owner: "KATTCORP",
    repo: "isbabyoutyet",
    token: null,
    fetch: async () => new Response("Not Found", { status: 404 }),
  });
  expect(fallback).toBe("pr-280");
});

test("env get parser uses the last non-empty line", () => {
  expect(parseEnvGetOutput("")).toBe(null);
  expect(parseEnvGetOutput("deadbeef\n")).toBe("deadbeef");
  expect(parseEnvGetOutput("log noise\n  abc123  \n")).toBe("abc123");
});
