import { expect, test } from "vitest";
import { prefetchCacheHeadersForTest } from "./convexPrefetch.functions";

test("anonymous Convex prefetches get a short shared Vercel cache", () => {
  const headers = prefetchCacheHeadersForTest.public("baby-waiting");

  expect(headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
  expect(headers.get("Vercel-CDN-Cache-Control")).toContain("s-maxage=60");
  expect(headers.get("Vercel-Cache-Tag")).toBe("prefetch:baby:baby-waiting");
  expect(headers.get("Vary")).toBeNull();
});

test("authenticated Convex prefetches are private and vary by identity", () => {
  const headers = prefetchCacheHeadersForTest.private();

  expect(headers.get("Cache-Control")).toContain("private");
  expect(headers.get("Cache-Control")).toContain("no-store");
  expect(headers.get("Vercel-CDN-Cache-Control")).toBe("private, no-store");
  expect(headers.get("Vary")).toBe("Cookie, Authorization");
});
