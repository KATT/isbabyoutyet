import { convexQuery } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "@workspace/convex/convex/_generated/api";

/** Drops cached auth-scoped reads on sign-in, sign-out, and session expiry. */
export function clearAuthQueryCache(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: convexQuery(api.profile.get, {}).queryKey });
  queryClient.removeQueries({ queryKey: convexQuery(api.baby.listByUser, {}).queryKey });
  queryClient.removeQueries({ queryKey: convexQuery(api.onboarding.getMine, {}).queryKey });
}
