import { expect, test } from "vitest";
import { prefetchCacheHeadersForTest } from "./convexPrefetch.functions";

test("anonymous Convex prefetches get a short shared Vercel cache", () => {
  const headers = prefetchCacheHeadersForTest.public("baby-waiting");

  expect(headers["Cache-Control"]).toBe("public, max-age=0, must-revalidate");
  expect(headers["Vercel-CDN-Cache-Control"]).toContain("s-maxage=60");
  expect(headers["Vercel-Cache-Tag"]).toBe("prefetch:baby:baby-waiting");
  expect(headers).not.toHaveProperty("Vary");
});

test("authenticated Convex prefetches are private and vary by identity", () => {
  const headers = prefetchCacheHeadersForTest.private();

  expect(headers["Cache-Control"]).toContain("private");
  expect(headers["Cache-Control"]).toContain("no-store");
  expect(headers["Vercel-CDN-Cache-Control"]).toBe("private, no-store");
  expect(headers.Vary).toBe("Cookie, Authorization");
});
