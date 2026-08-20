import { authServer } from "@/lib/auth-server";
import { convexQuery } from "@convex-dev/react-query";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { api } from "@workspace/convex/convex/_generated/api";
import { noIndexHeaders } from "@/lib/robots";

// Server function to check authentication
const getAuthToken = createServerFn({ method: "GET" }).handler(async () => {
  return await authServer.getToken();
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
    const preloader = opts.context.convexPreloader;

    if (typeof window === "undefined") {
      const token = opts.context.token ?? (await getAuthToken());
      if (!token) {
        throw redirect({ to: "/" });
      }
      opts.context.convexClient.setAuth(async () => token);
      const profile = await opts.context.convexClient.query(api.profile.get, {});
      if (!profile) {
        throw redirect({ to: "/" });
      }
      opts.context.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, profile);
      return {
        locale: profile.locale,
        token,
        isAuthenticated: true,
        profile: authProfileHandle(profile),
      };
    }

    // Client navigations: the cached profile IS the auth signal — no token
    // round-trip (sign-out does a full page reload, so the cache can't say
    // "signed in" after logging out). If the session expires mid-browse the
    // cache self-heals: the live profile.get subscription flips to null (all
    // dashboard queries return empty for anonymous callers rather than
    // throwing), so the next navigation lands in the fallback below and
    // redirects home. A null profile means logged out or the websocket has not
    // re-authenticated after sign-in, so confirm with the server once.
    const profileHandle = await preloader.ensureQueryData(api.profile.get, {});
    let profile = profileHandle.initialData;
    if (!profile) {
      const token = await getAuthToken();
      if (!token) {
        throw redirect({ to: "/" });
      }
      // Right after login, authenticate the Convex client with the fresh token
      // before reading the profile created by the auth hook.
      opts.context.convexClient.setAuth(async () => token);
      profile = await opts.context.convexClient.query(api.profile.get, {});
      if (!profile) {
        throw redirect({ to: "/" });
      }
      opts.context.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, profile);
    }
    return {
      locale: profile.locale,
      token: opts.context.token,
      isAuthenticated: true,
      profile: authProfileHandle(profile),
    };
  },
  component: AuthLayout,
});

function authProfileHandle(
  profile: NonNullable<PreloadedConvexQuery<typeof api.profile.get>["initialData"]>,
): PreloadedConvexQuery<typeof api.profile.get> {
  return { input: {}, initialData: profile };
}

function AuthLayout() {
  return <Outlet />;
}
