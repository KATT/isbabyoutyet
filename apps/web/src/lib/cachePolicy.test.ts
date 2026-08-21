import { describe, expect, test } from "vitest";
import {
  applyCachePolicy,
  authPageCacheHeaders,
  babyRouteCacheHeaders,
  homepageCacheHeaders,
  privateCacheHeaders,
  previewCacheHeaders,
  withPublicCache,
} from "./cachePolicy";

function responseFor(path: string, method: string) {
  const request = new Request(`https://example.com${path}`, { method });
  return applyCachePolicy(request, new Response("ok"));
}

describe("applyCachePolicy", () => {
  test.each([
    ["/", "homepage"],
    ["/preview?name=Sam", "preview"],
    ["/auth/login", "auth-pages"],
    ["/robots.txt", "discovery"],
  ])("caches the public route %s", (path, expectedTag) => {
    const response = responseFor(path, "GET");

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toContain("s-maxage=");
    expect(response.headers.get("Vercel-Cache-Tag")).toContain(expectedTag);
  });

  test("tags every public representation of a baby for targeted deletion", () => {
    const publicPages = [
      "/baby/juniper-hale",
      "/baby/juniper-hale/",
      "/baby/juniper-hale/share",
      "/baby/juniper-hale/photo",
      "/baby/juniper-hale/updates/update-123/photo",
    ];
    const image = responseFor("/og/baby/juniper-hale", "GET");
    const manifest = responseFor("/baby/manifest/j57abc", "GET");

    for (const path of publicPages) {
      expect(responseFor(path, "GET").headers.get("Vercel-Cache-Tag")).toBe(
        "baby-pages,baby-public-id:juniper-hale",
      );
    }
    expect(image.headers.get("Vercel-Cache-Tag")).toBe("baby-pages,baby-public-id:juniper-hale");
    expect(manifest.headers.get("Vercel-Cache-Tag")).toBe("baby-pages,baby-id:j57abc");
  });

  test.each([
    ["/dashboard", "GET"],
    ["/api/auth/session", "GET"],
    ["/_server/functions/getAuth", "GET"],
    ["/baby/juniper-hale", "POST"],
    ["/baby/juniper-hale/settings", "GET"],
    ["/baby/juniper-hale/post", "GET"],
  ])("keeps %s %s private", (path, method) => {
    const response = responseFor(path, method);

    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Vercel-Cache-Tag")).toBeNull();
  });

  test("preserves an explicit no-store redirect on an otherwise public route", () => {
    const response = applyCachePolicy(
      new Request("https://example.com/og/baby/juniper-hale"),
      new Response(null, {
        status: 307,
        headers: {
          "Cache-Control": "no-store",
          Location: "https://example.com/og/baby/juniper-hale?v=current",
        },
      }),
    );

    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toContain("no-store");
    expect(response.headers.get("Vercel-Cache-Tag")).toBeNull();
  });

  test("preserves existing vary values while adding cache key inputs", () => {
    const request = new Request("https://example.com/");
    const response = applyCachePolicy(
      request,
      new Response("ok", { headers: { Vary: "Accept-Encoding" } }),
    );

    expect(response.headers.get("Vary")).toBe("Accept-Encoding, Accept-Language, Cookie");
  });

  test("builds route-level public and private cache headers", () => {
    expect(privateCacheHeaders()).toMatchObject({
      "Cache-Control": expect.stringContaining("private"),
      "Vercel-CDN-Cache-Control": expect.stringContaining("no-store"),
    });
    expect(homepageCacheHeaders()["Vercel-Cache-Tag"]).toBe("homepage");
    expect(previewCacheHeaders()["Vercel-Cache-Tag"]).toBe("preview");
    expect(authPageCacheHeaders()["Vercel-Cache-Tag"]).toBe("auth-pages");
  });

  test.each([
    "/baby/$publicId/",
    "/baby/$publicId/share",
    "/baby/$publicId/photo",
    "/baby/$publicId/updates/$updateId/photo",
  ])("treats the %s overlay match as public", (routeId) => {
    const headers = babyRouteCacheHeaders({
      publicId: "juniper-hale",
      routeIds: ["/baby/$publicId", routeId],
    });

    expect(headers["Cache-Control"]).toContain("public");
    expect("Vercel-Cache-Tag" in headers && headers["Vercel-Cache-Tag"]).toContain(
      "baby-public-id:juniper-hale",
    );
  });

  test.each([
    "/baby/$publicId/settings",
    "/baby/$publicId/post",
    "/baby/$publicId/future-manager-overlay",
  ])("treats the %s overlay match as private", (routeId) => {
    const headers = babyRouteCacheHeaders({
      publicId: "juniper-hale",
      routeIds: ["/baby/$publicId", routeId],
    });

    expect(headers["Cache-Control"]).toContain("private");
    expect(headers["Cache-Control"]).toContain("no-store");
    expect(headers).not.toHaveProperty("Vercel-Cache-Tag");
  });

  test("adds public caching to resource responses without losing their headers", async () => {
    const response = withPublicCache(
      new Response("manifest", { headers: { "Content-Type": "application/manifest+json" } }),
      { maxAgeSeconds: 600, tags: ["baby-id:123"] },
    );

    expect(response.headers.get("Content-Type")).toBe("application/manifest+json");
    expect(response.headers.get("Vercel-Cache-Tag")).toBe("baby-id:123");
    expect(await response.text()).toBe("manifest");
  });
});
