export function publicPrefetchHeaders(publicId: string) {
  return {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Vercel-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    "Vercel-Cache-Tag": `prefetch:baby:${publicId}`.slice(0, 256),
  };
}

export function privatePrefetchHeaders() {
  return {
    "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
    "Vercel-CDN-Cache-Control": "private, no-store",
    Vary: "Cookie, Authorization",
  };
}
