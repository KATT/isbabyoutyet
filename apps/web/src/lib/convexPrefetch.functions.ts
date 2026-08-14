/* v8 ignore file -- transformed server-function glue is verified by build and HTTP integration tests */
import { ConvexHttpClient } from "convex/browser";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { api } from "@workspace/convex/convex/_generated/api";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import * as z from "zod";
import { authServer } from "./auth-server";
import { privatePrefetchHeaders, publicPrefetchHeaders } from "./convexPrefetchCache";

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

function setCompatibleResponseHeaders(headers: Record<string, string>) {
  // TanStack Start 1.169's runtime iterates Object.entries even though its
  // declaration currently requires a Headers-shaped TypedHeaders value.
  setResponseHeaders(headers as unknown as Parameters<typeof setResponseHeaders>[0]);
}

/**
 * Experimental anonymous prefetch seam. The server function response is safe
 * for a shared cache because this client never receives an auth token.
 */
export const preloadPublicBaby = createServerFn({ method: "GET" })
  .inputValidator(publicBabyInput)
  .handler(async (opts) => {
    setCompatibleResponseHeaders(publicPrefetchHeaders(opts.data.id));
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
  setCompatibleResponseHeaders(privatePrefetchHeaders());
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
