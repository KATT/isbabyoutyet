import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { makeResource } from "./test.resource";
import { modules } from "./test.setup";

test("gitSha returns a development placeholder when the deploy hash is unset", async () => {
  vi.stubEnv("GIT_SHA", "");
  await using _env = makeResource({}, () => {
    vi.unstubAllEnvs();
  });

  const t = convexTest(schema, modules);
  expect(await t.query(api.version.gitSha, {})).toBe("development");
});

test("gitSha returns the configured deploy hash", async () => {
  vi.stubEnv("GIT_SHA", "abc123def456");
  await using _env = makeResource({}, () => {
    vi.unstubAllEnvs();
  });

  const t = convexTest(schema, modules);
  expect(await t.query(api.version.gitSha, {})).toBe("abc123def456");
});
