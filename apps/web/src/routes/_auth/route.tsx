import { authServer } from "@/lib/auth-server";
import { convexQuery } from "@convex-dev/react-query";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { QueryClient } from "@tanstack/react-query";
import type { ConvexQueryPreloader } from "@workspace/convex-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import type { ConvexReactClient } from "convex/react";
import { noIndexHeaders } from "@/lib/robots";

// Server function to check authentication
const getAuthToken = createServerFn({ method: "GET" }).handler(async () => {
  return await authServer.getToken();
});

type AuthGuardContext = {
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
  convexPreloader: ConvexQueryPreloader;
  token: string | null;
};

/**
 * The `/_auth` guard, with the auth-token round-trip taken as a dependency
 * (defaulted to the real `createServerFn` one by the route) so tests can drive
 * both the SSR and client branches — the real server function throws outside
 * an actual TanStack Start request.
 *
 * @internal exported for tests
 */
export async function resolveAuthGuard(opts: {
  context: AuthGuardContext;
  fetchToken: () => Promise<string | null>;
}) {
  const preloader = opts.context.convexPreloader;

  if (globalThis.window === undefined) {
    const token = opts.context.token ?? (await opts.fetchToken());
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
    const token = await opts.fetchToken();
    if (!token) {
      throw redirect({ to: "/" });
    }
    // The mounted provider exclusively owns browser Convex authentication.
    // A fresh session can invalidate a cached anonymous profile, so retry
    // once without replacing the provider's token callback.
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
}

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
    return await resolveAuthGuard({
      context: opts.context,
      fetchToken: async () => (await getAuthToken()) ?? null,
    });
  },
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
