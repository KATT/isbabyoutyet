import { QueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test } from "vitest";
import { clearAuthQueryCache } from "@/lib/auth-query-cache";

test("clearAuthQueryCache drops every cached query, not only auth-scoped keys", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, {
    locale: "en-GB",
    timeZone: "Europe/London",
    isAdmin: false,
  });
  queryClient.setQueryData(["unrelated"], { keep: true });

  clearAuthQueryCache(queryClient);

  expect(queryClient.getQueryCache().getAll()).toEqual([]);
});
