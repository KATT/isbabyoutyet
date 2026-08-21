import { authServer } from "@/lib/auth-server";
import { convexQuery } from "@convex-dev/react-query";
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
      "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
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
      opts.context.convexQueryClient.serverHttpClient?.setAuth(token);
      opts.context.convexClient.setAuth(async () => token);
      const profileHandle = await preloader.ensureQueryData(api.profile.get, {});
      const profile = profileHandle.initialData;
      if (!profile) {
        throw redirect({ to: "/" });
      }
      return {
        locale: profile.locale,
        token,
        isAuthenticated: true,
        profile: profileHandle,
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
    let profileHandle = await preloader.ensureQueryData(api.profile.get, {});
    let profile = profileHandle.initialData;
    if (!profile) {
      const token = await getAuthToken();
      if (!token) {
        throw redirect({ to: "/" });
      }
      // Right after login, authenticate the Convex client with the fresh token
      // before reading the profile created by the auth hook.
      opts.context.convexClient.setAuth(async () => token);
      opts.context.queryClient.removeQueries({
        queryKey: convexQuery(api.profile.get, {}).queryKey,
      });
      profileHandle = await preloader.ensureQueryData(api.profile.get, {});
      profile = profileHandle.initialData;
      if (!profile) {
        throw redirect({ to: "/" });
      }
    }
    return {
      locale: profile.locale,
      token: opts.context.token,
      isAuthenticated: true,
      profile: profileHandle,
    };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
