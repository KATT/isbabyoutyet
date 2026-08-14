import { ConvexHttpClient } from "convex/browser";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { api } from "@workspace/convex/convex/_generated/api";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import * as z from "zod";
import { authServer } from "./auth-server";

const publicBabyInput = z.object({
  id: z.string(),
});

function convexUrl() {
  const url = import.meta.env.VITE_CONVEX_URL;
  if (!url) {
    throw new Error("VITE_CONVEX_URL is not set");
  }
  return url;
}

function publicPrefetchHeaders(publicId: string) {
  return {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Vercel-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    "Vercel-Cache-Tag": `prefetch:baby:${publicId}`.slice(0, 256),
  };
}

function privatePrefetchHeaders() {
  return {
    "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
    "Vercel-CDN-Cache-Control": "private, no-store",
    Vary: "Cookie, Authorization",
  };
}

/**
 * Experimental anonymous prefetch seam. The server function response is safe
 * for a shared cache because this client never receives an auth token.
 */
export const preloadPublicBaby = createServerFn({ method: "GET" })
  .inputValidator(publicBabyInput)
  .handler(async (opts) => {
    setResponseHeaders(publicPrefetchHeaders(opts.data.id));
    const input = { id: opts.data.id };
    const client = new ConvexHttpClient(convexUrl());
    const initialData = await client.query(api.baby.getByPublicId, input);
    return { input, initialData } satisfies PreloadedConvexQuery<typeof api.baby.getByPublicId>;
  });

/**
 * Experimental authenticated counterpart. It deliberately has a separate
 * server-function endpoint and always opts out of intermediary caching.
 */
export const preloadPrivateProfile = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeaders(privatePrefetchHeaders());
  const token = await authServer.getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const client = new ConvexHttpClient(convexUrl());
  client.setAuth(token);
  const input = {};
  const initialData = await client.query(api.profile.get, input);
  return { input, initialData } satisfies PreloadedConvexQuery<typeof api.profile.get>;
});

export const prefetchCacheHeadersForTest = {
  public: publicPrefetchHeaders,
  private: privatePrefetchHeaders,
};
