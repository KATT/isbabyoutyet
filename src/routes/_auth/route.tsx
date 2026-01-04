import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { authServer } from "@/lib/auth-server";
import type { ConvexQueryClient } from "@convex-dev/react-query";

// Server function to check authentication
const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const token = await authServer.getToken();
  return { isAuthenticated: !!token, token };
});

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context }) => {
    // Check authentication server-side
    const authResult = await checkAuth();

    if (!authResult.isAuthenticated) {
      throw redirect({
        to: "/",
      });
    }

    // Set the auth token for Convex queries during SSR if we have a valid token
    if (authResult.token) {
      const convexQueryClient = (context as { convexQueryClient: ConvexQueryClient })
        .convexQueryClient;
      // During SSR only (the only time serverHttpClient exists),
      // set the auth token to make HTTP queries with.
      convexQueryClient.serverHttpClient?.setAuth(authResult.token);
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
