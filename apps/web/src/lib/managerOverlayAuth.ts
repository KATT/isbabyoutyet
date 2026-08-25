import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { ConvexReactClient } from "convex/react";
import { createServerFn } from "@tanstack/react-start";
import { authServer } from "@/lib/auth-server";

const getManagerOverlayToken = createServerFn({ method: "GET" }).handler(async () => {
  return await authServer.getToken();
});

type ManagerOverlayAuthContext = {
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
};

/**
 * Authenticates only manager-overlay SSR. Public baby documents remain
 * anonymous/cacheable, while direct `/settings` and `/post` requests can run
 * their private loaders without putting identity into a shared response.
 *
 * Takes the token fetcher as a dependency (defaulted to the real
 * `createServerFn`-wrapped one by {@link authenticateManagerOverlaySsr}) so
 * tests can inject a stub — the real server function throws outside an
 * actual TanStack Start request ("No Start context found").
 */
export async function authenticateManagerOverlaySsrWithToken(opts: {
  context: ManagerOverlayAuthContext;
  fetchToken: () => Promise<string | null>;
}) {
  if (typeof window !== "undefined") {
    return null;
  }

  const token = await opts.fetchToken();
  if (!token) {
    return null;
  }

  opts.context.convexQueryClient.serverHttpClient?.setAuth(token);
  opts.context.convexClient.setAuth(async () => token);
  return token;
}

export async function authenticateManagerOverlaySsr(context: ManagerOverlayAuthContext) {
  return authenticateManagerOverlaySsrWithToken({
    context,
    fetchToken: async () => (await getManagerOverlayToken()) ?? null,
  });
}
