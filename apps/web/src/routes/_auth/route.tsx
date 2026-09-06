import { authServer } from "@/lib/auth-server";
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
  convexClient: ConvexReactClient;
  convexPreloader: ConvexQueryPreloader;
  convexQueryClient: ConvexQueryClient;
  queryClient: QueryClient;
  token: string | null;
};

function redirectToLogin(pathname: string): never {
  throw redirect({
    replace: true,
    search: { redirect: pathname },
    to: "/auth/login",
  });
}

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
  pathname: string;
}) {
  const preloader = opts.context.convexPreloader;

  if (globalThis.window === undefined) {
    const token = opts.context.token ?? (await opts.fetchToken());
    if (!token) {
      redirectToLogin(opts.pathname);
    }
    opts.context.convexQueryClient.serverHttpClient?.setAuth(token);
    opts.context.convexClient.setAuth(async () => token);
    const profileHandle = await preloader.ensureQueryData(api.profile.get, {});
    const profile = profileHandle.initialData;
    if (!profile) {
      redirectToLogin(opts.pathname);
    }
    return {
      locale: profile.locale,
      profile: profileHandle,
      token,
    };
  }

  // Client navigations: the cached profile IS the auth signal — no token
  // round-trip. Login/signup already wait for `profile.get` before navigating
  // here. If the session expires mid-browse the cache self-heals: profile.get
  // flips to null and the next navigation sends the user back to login.
  const profileHandle = await preloader.ensureQueryData(api.profile.get, {});
  const profile = profileHandle.initialData;
  if (!profile) {
    redirectToLogin(opts.pathname);
  }
  return {
    locale: profile.locale,
    profile: profileHandle,
    token: opts.context.token,
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
      pathname: opts.location.pathname,
    });
  },
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
