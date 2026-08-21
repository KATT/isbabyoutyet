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
 */
export async function authenticateManagerOverlaySsr(context: ManagerOverlayAuthContext) {
  if (typeof window !== "undefined") {
    return null;
  }

  const token = await getManagerOverlayToken();
  if (!token) {
    return null;
  }

  context.convexQueryClient.serverHttpClient?.setAuth(token);
  context.convexClient.setAuth(async () => token);
  return token;
}
