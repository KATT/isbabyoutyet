import type { QueryClient } from "@tanstack/react-query";

/** Drops every cached read when the session is gone so no user data survives. */
export function clearAuthQueryCache(queryClient: QueryClient) {
  queryClient.clear();
}
