import { authServer } from "@/lib/auth-server";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

// Server function to check authentication
const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const token = await authServer.getToken();
  return { token };
});

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context }) => {
    // Check authentication server-side
    const authResult = await checkAuth();

    if (!authResult.token) {
      throw redirect({
        to: "/",
      });
    }

    // During SSR only (the only time serverHttpClient exists),
    // set the auth token to make HTTP queries with.
    context.convexQueryClient.serverHttpClient?.setAuth(authResult.token);
  },
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
