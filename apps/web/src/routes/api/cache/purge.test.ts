import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { deriveCachePurgeToken } from "@workspace/convex/src/cacheTags";

const dangerouslyDeleteByTag =
  vi.fn<
    (tags: string[], options: { revalidationDeadlineSeconds: number }) => Promise<void>
  >();

vi.mock("@vercel/functions", () => ({
  dangerouslyDeleteByTag,
}));

const { handleCachePurge } = await import("./purge");

function envResource() {
  return makeResource({}, () => {
    vi.unstubAllEnvs();
    dangerouslyDeleteByTag.mockReset();
  });
}

function purgeRequest(opts: { token: string; tags: string[] }) {
  return new Request("https://example.com/api/cache/purge", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tags: opts.tags }),
  });
}

test("rejects callers without the deployment-derived bearer token", async () => {
  await using _env = envResource();
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");

  const response = await handleCachePurge(purgeRequest({ token: "wrong", tags: ["baby-id:123"] }));

  expect(response.status).toBe(401);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(dangerouslyDeleteByTag).not.toHaveBeenCalled();
});

test("deletes matching Vercel cache tags in the foreground", async () => {
  await using _env = envResource();
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
  vi.stubEnv("VERCEL", "1");
  const token = await deriveCachePurgeToken("test-secret");

  const response = await handleCachePurge(
    purgeRequest({ token, tags: ["baby-id:123", "baby-public-id:baby-smith"] }),
  );

  expect(response.status).toBe(200);
  expect(dangerouslyDeleteByTag).toHaveBeenCalledWith(
    ["baby-id:123", "baby-public-id:baby-smith"],
    { revalidationDeadlineSeconds: 0 },
  );
});
