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

/**
 * Backoff while Convex's websocket catches up to a just-set Better Auth
 * cookie. The first attempt is immediate so a ready client does not wait.
 */
const CLIENT_AUTH_CATCHUP_DELAYS_MS = [0, 50, 100, 200, 400, 800];

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * The `/_auth` guard, with the auth-token round-trip taken as a dependency
 * (defaulted to the real `createServerFn` one by the route) so tests can drive
 * both the SSR and client branches — the real server function throws outside
 * an actual TanStack Start request.
 *
 * `waitForCatchup` is the pause between client-side profile refetches after a
 * fresh session. Pass `null` to use `setTimeout`; tests pass a no-op so
 * retries stay synchronous.
 *
 * @internal exported for tests
 */
export async function resolveAuthGuard(opts: {
  context: AuthGuardContext;
  fetchToken: () => Promise<string | null>;
  waitForCatchup: ((delayMs: number) => Promise<void>) | null;
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
      isAuthenticated: true,
      locale: profile.locale,
      profile: profileHandle,
      token,
    };
  }

  // Client navigations: the cached profile IS the auth signal — no token
  // round-trip. If the session expires mid-browse the cache self-heals:
  // profile.get flips to null and the next navigation confirms with the
  // server, then redirects home. A null profile right after sign-in also
  // lands here: the cookie is set, but ConvexBetterAuthProvider only calls
  // setAuth in an effect, so the websocket may still be anonymous.
  let profileHandle = await preloader.ensureQueryData(api.profile.get, {});
  let profile = profileHandle.initialData;
  if (!profile) {
    const token = await opts.fetchToken();
    if (!token) {
      throw redirect({ to: "/" });
    }
    // The mounted provider exclusively owns browser Convex authentication.
    // Clear anonymous cache, then refetch until Convex confirms the session
    // (or the backoff is exhausted). Do not replace the provider's callback.
    opts.context.queryClient.clear();
    const waitForCatchup = opts.waitForCatchup ?? delay;
    for (const delayMs of CLIENT_AUTH_CATCHUP_DELAYS_MS) {
      if (delayMs > 0) {
        await waitForCatchup(delayMs);
      }
      profileHandle = await preloader.fetchQueryData(api.profile.get, {});
      profile = profileHandle.initialData;
      if (profile) {
        break;
      }
    }
    if (!profile) {
      throw redirect({ to: "/" });
    }
  }
  return {
    isAuthenticated: true,
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
      waitForCatchup: null,
    });
  },
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
