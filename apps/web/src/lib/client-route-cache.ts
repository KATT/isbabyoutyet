import { api } from "@workspace/convex/convex/_generated/api";
import type { ConvexReactClient } from "convex/react";

/**
 * Client-side read-through cache for the Convex queries that route guards
 * await in `beforeLoad`.
 *
 * TanStack Router caches loader data, but `beforeLoad` re-runs on every
 * client navigation (back button included), so awaiting the network there
 * taxes every navigation. These helpers hold a Convex subscription for each
 * guard query: after the first resolution the local result is returned
 * synchronously, and the held subscription keeps it fresh reactively
 * (login/logout and document edits re-run the query automatically).
 *
 * SSR never calls these — server-side guards keep using request-scoped,
 * cookie-authenticated fetches.
 */

const heldSubscriptions = new Set<string>();

function holdSubscription(key: string, watch: { onUpdate: (callback: () => void) => () => void }) {
  if (heldSubscriptions.has(key)) {
    return;
  }
  heldSubscriptions.add(key);
  // Intentionally never unsubscribed: keeping the subscription alive is what
  // keeps the local result warm for later navigations.
  watch.onUpdate(() => {});
}

export async function getClientProfile(convexClient: ConvexReactClient) {
  const watch = convexClient.watchQuery(api.profile.get, {});
  holdSubscription("profile", watch);
  const cached = watch.localQueryResult();
  if (cached !== undefined) {
    return cached;
  }
  return await convexClient.query(api.profile.get, {});
}

export async function getClientBabyByPublicId(convexClient: ConvexReactClient, publicId: string) {
  const watch = convexClient.watchQuery(api.baby.getByPublicId, { id: publicId });
  holdSubscription(`baby:${publicId}`, watch);
  const cached = watch.localQueryResult();
  if (cached !== undefined) {
    return cached;
  }
  return await convexClient.query(api.baby.getByPublicId, { id: publicId });
}
