import { expect, test } from "vitest";
import {
  computeSchemaFingerprint,
  parseEnvGetOutput,
  previewDeployCliArgs,
  shouldRecreatePreview,
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

test("preview deploy flags wipe and seed only when recreating", () => {
  expect(previewDeployCliArgs("feat/demo", true)).toEqual([
    "--preview-create",
    "feat/demo",
    "--preview-run",
    "seed:seedDemoData",
  ]);
  expect(previewDeployCliArgs("feat/demo", false)).toEqual(["--preview-name", "feat/demo"]);
});

test("env get parser uses the last non-empty line", () => {
  expect(parseEnvGetOutput("")).toBe(null);
  expect(parseEnvGetOutput("deadbeef\n")).toBe("deadbeef");
  expect(parseEnvGetOutput("log noise\n  abc123  \n")).toBe("abc123");
});
