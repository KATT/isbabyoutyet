import { authServer } from "@/lib/auth-server";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { OnboardingHost } from "@/components/onboarding/onboarding-host";

// Server function to check authentication
const getToken = createServerFn({ method: "GET" }).handler(async () => {
  const token = await authServer.getToken();
  return token;
});

export const Route = createFileRoute("/_auth")({
  headers() {
    return {
      Vary: "Cookie",
    };
  },
  beforeLoad: async (opts) => {
    // Check authentication server-side
    const token = await getToken();

    if (!token) {
      throw redirect({
        to: "/",
      });
    }
    if (typeof window === "undefined") {
      opts.context.convexClient.setAuth(async () => {
        return token;
      });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <>
      <OnboardingHost surface="dashboard" />
      <Outlet />
    </>
  );
}
