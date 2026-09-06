import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { ConvexQueryPreloader } from "@workspace/convex-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import type { ConvexReactClient } from "convex/react";
import { waitForMeQuery } from "./convex-auth";

export type SignedInProfileContext = {
  convexClient: ConvexReactClient;
  convexPreloader: ConvexQueryPreloader;
  convexQueryClient: ConvexQueryClient;
  queryClient: QueryClient;
  token: string | null | undefined;
};

/**
 * How long the client guard waits for Convex to confirm a session whose
 * Better Auth cookie already exists. Login only waits `SETTLED_ME_WAIT_MS`
 * before navigating; the remaining catch-up (session refetch → token →
 * websocket re-auth) is three sequential round-trips in production.
 *
 * @internal Exported for tests.
 */
export const AUTH_GUARD_CATCHUP_MS = 8000;

/**
 * Shared signed-in signal for `/_auth` and baby manager overlays.
 *
 * SSR: cookie token, then `profile.get`.
 *
 * Client: a cached, present `profile.get` is the auth signal — no round-trip.
 * A cached `null` is not enough to bounce: login's `waitForMe` times out
 * while the Better Auth cookie is already set and the websocket is still
 * anonymous. Confirm the cookie first (one server-function call, only on
 * this miss); without it bounce immediately. With it, keep waiting on the
 * same live `profile.get` observer login used, up to `catchUpSignal`
 * (default `AUTH_GUARD_CATCHUP_MS`), then re-read the cache.
 *
 * Returns `null` when the user is not signed in so callers can bounce to
 * their own login (dashboard `/auth/login` vs baby-page overlay).
 *
 * `locale` is the signed-in profile language for dashboard `/_auth`. Baby
 * manager overlays must not put it in route context — the baby page already
 * set `resolvedLocale`, and a later match would overwrite it.
 */
export async function loadSignedInProfile(opts: {
  /** `null` uses `AbortSignal.timeout(AUTH_GUARD_CATCHUP_MS)`. */
  catchUpSignal: AbortSignal | null;
  context: SignedInProfileContext;
  fetchToken: () => Promise<string | null>;
}) {
  const preloader = opts.context.convexPreloader;

  if (globalThis.window === undefined) {
    const token = opts.context.token ?? (await opts.fetchToken());
    if (!token) {
      return null;
    }
    opts.context.convexQueryClient.serverHttpClient?.setAuth(token);
    opts.context.convexClient.setAuth(async () => token);
    const profileHandle = await preloader.ensureQueryData(api.profile.get, {});
    const profile = profileHandle.initialData;
    if (!profile) {
      return null;
    }
    return {
      locale: profile.locale,
      profile: profileHandle,
      token,
    };
  }

  const cachedHandle = await preloader.ensureQueryData(api.profile.get, {});
  const cachedProfile = cachedHandle.initialData;
  if (cachedProfile) {
    return {
      locale: cachedProfile.locale,
      profile: cachedHandle,
      token: opts.context.token,
    };
  }

  const token = await opts.fetchToken();
  if (!token) {
    return null;
  }

  // The mounted provider owns browser Convex authentication; do not replace
  // its callback here. Wait for it to flip `profile.get`, then read the cache.
  await waitForMeQuery({
    convexQueryClient: opts.context.convexQueryClient,
    presence: "present",
    queryClient: opts.context.queryClient,
    signal: opts.catchUpSignal ?? AbortSignal.timeout(AUTH_GUARD_CATCHUP_MS),
  });
  const caughtUpHandle = await preloader.ensureQueryData(api.profile.get, {});
  const caughtUpProfile = caughtUpHandle.initialData;
  if (!caughtUpProfile) {
    return null;
  }
  return {
    locale: caughtUpProfile.locale,
    profile: caughtUpHandle,
    token,
  };
}
