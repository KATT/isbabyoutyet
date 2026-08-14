import { authServer } from "@/lib/auth-server";
import { getClientProfile } from "@/lib/client-route-cache";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { api } from "@workspace/convex/convex/_generated/api";
import { noIndexHeaders } from "@/lib/robots";

// Server function to check authentication
const getToken = createServerFn({ method: "GET" }).handler(async () => {
  const token = await authServer.getToken();
  return token;
});

export const Route = createFileRoute("/_auth")({
  headers() {
    return {
      Vary: "Cookie",
      // Prefer header over route `head` — TanStack's head+beforeLoad typing
      // currently collapses child beforeLoad to `never` when the layout sets head.
      ...noIndexHeaders(),
    };
  },
  beforeLoad: async (opts) => {
    if (typeof window !== "undefined") {
      // Fast path for client navigations: the profile comes from a held
      // Convex subscription (kept fresh reactively), so nothing is awaited
      // over the network. A null profile (logged out, or first navigation
      // before the cache is warm) falls through to the full check below.
      const cachedProfile = await getClientProfile(opts.context.convexClient);
      if (cachedProfile) {
        return { locale: cachedProfile.locale };
      }
    }
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
