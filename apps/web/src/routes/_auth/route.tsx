import { authServer } from "@/lib/auth-server";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { api } from "@workspace/convex/convex/_generated/api";
import { robotsNoIndexMeta } from "@/lib/seo";

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
  head: () => ({
    meta: [...robotsNoIndexMeta()],
  }),
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
    const existingProfile = await opts.context.convexClient.query(api.profile.get, {});
    const profile =
      existingProfile ??
      (await opts.context.convexClient.mutation(api.profile.ensure, {
        browserLocale: opts.context.locale,
      }));
    return { locale: profile.locale };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
