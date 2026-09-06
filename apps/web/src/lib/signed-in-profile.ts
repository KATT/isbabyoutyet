import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { ConvexQueryPreloader } from "@workspace/convex-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import type { ConvexReactClient } from "convex/react";

export type SignedInProfileContext = {
  convexClient: ConvexReactClient;
  convexPreloader: ConvexQueryPreloader;
  convexQueryClient: ConvexQueryClient;
  queryClient: QueryClient;
  token: string | null | undefined;
};

/**
 * Backoff while Convex's websocket catches up to a just-set Better Auth
 * cookie. The first attempt is immediate so a ready client does not wait.
 */
const CLIENT_AUTH_CATCHUP_DELAYS_MS = [0, 50, 100, 200, 400, 800];

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Shared signed-in signal for `/_auth` and baby manager overlays.
 *
 * SSR: cookie token, then `profile.get`. Client: cached `profile.get` when
 * present. A missing profile is not treated as logged-out until the cookie
 * token is checked — login can navigate before Convex's websocket catches
 * up, leaving a stale anonymous `null` in the cache. No token → logged out.
 * Token present → refetch until `profile.get` confirms (or backoff ends).
 *
 * Returns `null` when the user is not signed in so callers can bounce to
 * their own login (dashboard `/auth/login` vs baby-page overlay).
 *
 * `locale` is the signed-in profile language for dashboard `/_auth`. Baby
 * manager overlays must not put it in route context — the baby page already
 * set `resolvedLocale`, and a later match would overwrite it.
 */
export async function loadSignedInProfile(opts: {
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

  let profileHandle = await preloader.ensureQueryData(api.profile.get, {});
  let profile = profileHandle.initialData;
  if (!profile) {
    const token = await opts.fetchToken();
    if (!token) {
      return null;
    }
    opts.context.queryClient.clear();
    for (const delayMs of CLIENT_AUTH_CATCHUP_DELAYS_MS) {
      if (delayMs > 0) {
        await sleep(delayMs);
      }
      profileHandle = await preloader.fetchQueryData(api.profile.get, {});
      profile = profileHandle.initialData;
      if (profile) {
        break;
      }
    }
    if (!profile) {
      return null;
    }
    return {
      locale: profile.locale,
      profile: profileHandle,
      token,
    };
  }
  return {
    locale: profile.locale,
    profile: profileHandle,
    token: opts.context.token,
  };
}
