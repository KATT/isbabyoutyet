import { authServer } from "@/lib/auth-server";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

// Server function to check authentication
const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const token = await authServer.getToken();
  return { token };
});

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    // Check authentication server-side
    const authResult = await checkAuth();

    if (!authResult.token) {
      throw redirect({
        to: "/",
      });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
