import {
  ALL_BABY_PAGES_CACHE_TAG,
  babyIdCacheTag,
  babyPublicIdCacheTag,
} from "@workspace/convex/src/cacheTags";

const PRIVATE_CACHE_CONTROL = "private, no-store, no-cache, max-age=0, must-revalidate";
const PUBLIC_BROWSER_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const PUBLIC_STALE_SECONDS = 86_400;

export type PublicCachePolicy = {
  maxAgeSeconds: number;
  tags: readonly string[];
};

export function publicCacheHeaders(policy: PublicCachePolicy) {
  return {
    "Cache-Control": PUBLIC_BROWSER_CACHE_CONTROL,
    "Vercel-CDN-Cache-Control": `public, s-maxage=${policy.maxAgeSeconds}, stale-while-revalidate=${PUBLIC_STALE_SECONDS}`,
    "Vercel-Cache-Tag": policy.tags.join(","),
    Vary: "Accept-Language, Cookie",
  };
}

export function privateCacheHeaders() {
  return {
    "Cache-Control": PRIVATE_CACHE_CONTROL,
    "Vercel-CDN-Cache-Control": PRIVATE_CACHE_CONTROL,
    Vary: "Cookie",
  };
}

export function withPublicCache(response: Response, policy: PublicCachePolicy) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(publicCacheHeaders(policy))) {
    headers.set(name, value);
  }
  return responseWithHeaders(response, headers);
}

function publicPagePolicy(pathname: string): PublicCachePolicy | null {
  if (pathname === "/") {
    return { maxAgeSeconds: 86_400, tags: ["homepage"] };
  }
  if (pathname === "/preview") {
    return { maxAgeSeconds: 86_400, tags: ["preview"] };
  }
  if (pathname === "/auth/login" || pathname === "/auth/signup") {
    return { maxAgeSeconds: 3_600, tags: ["auth-pages"] };
  }
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    return { maxAgeSeconds: 3_600, tags: ["discovery"] };
  }
  if (pathname === "/og") {
    return { maxAgeSeconds: 86_400, tags: ["homepage"] };
  }

  const manifestMatch = /^\/baby\/manifest\/([^/]+)$/.exec(pathname);
  if (manifestMatch?.[1]) {
    return {
      maxAgeSeconds: 86_400,
      tags: [ALL_BABY_PAGES_CACHE_TAG, babyIdCacheTag(manifestMatch[1])],
    };
  }

  const babyOgMatch = /^\/og\/baby\/([^/]+)$/.exec(pathname);
  if (babyOgMatch?.[1]) {
    return {
      maxAgeSeconds: 86_400,
      tags: [ALL_BABY_PAGES_CACHE_TAG, babyPublicIdCacheTag(babyOgMatch[1])],
    };
  }

  const babyPageMatch = /^\/baby\/([^/]+)$/.exec(pathname);
  if (babyPageMatch?.[1]) {
    return {
      maxAgeSeconds: 86_400,
      tags: [ALL_BABY_PAGES_CACHE_TAG, babyPublicIdCacheTag(babyPageMatch[1])],
    };
  }

  if (pathname.startsWith("/demo/start/")) {
    return { maxAgeSeconds: 3_600, tags: ["demo-pages"] };
  }

  return null;
}

function mergeVary(headers: Headers, values: readonly string[]) {
  const existing = headers
    .get("Vary")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  headers.set("Vary", Array.from(new Set([...(existing ?? []), ...values])).join(", "));
}

function responseWithHeaders(response: Response, headers: Headers) {
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/**
 * Makes caching deny-by-default at the final HTTP response seam. Public pages
 * are explicitly allowlisted and contain anonymous SSR only; everything else,
 * including auth endpoints and server functions, is private and non-cacheable.
 */
export function applyCachePolicy(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  const methodIsCacheable = request.method === "GET" || request.method === "HEAD";
  const policy = methodIsCacheable ? publicPagePolicy(new URL(request.url).pathname) : null;

  if (!policy) {
    headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);
    headers.set("Vercel-CDN-Cache-Control", PRIVATE_CACHE_CONTROL);
    headers.delete("Vercel-Cache-Tag");
    mergeVary(headers, ["Cookie"]);
    return responseWithHeaders(response, headers);
  }

  headers.set("Cache-Control", PUBLIC_BROWSER_CACHE_CONTROL);
  headers.set(
    "Vercel-CDN-Cache-Control",
    `public, s-maxage=${policy.maxAgeSeconds}, stale-while-revalidate=${PUBLIC_STALE_SECONDS}`,
  );
  headers.set("Vercel-Cache-Tag", policy.tags.join(","));
  mergeVary(headers, ["Accept-Language", "Cookie"]);
  return responseWithHeaders(response, headers);
}
