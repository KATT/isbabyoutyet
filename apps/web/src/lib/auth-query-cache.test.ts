import { QueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test } from "vitest";
import { clearAuthQueryCache } from "@/lib/auth-query-cache";

test("clearAuthQueryCache drops profile and auth-scoped dashboard reads", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, {
    locale: "en-GB",
    timeZone: "Europe/London",
    isAdmin: false,
  });
  queryClient.setQueryData(convexQuery(api.baby.listByUser, {}).queryKey, []);
  queryClient.setQueryData(convexQuery(api.onboarding.getMine, {}).queryKey, {
    welcomeDismissed: false,
    checklistDismissed: false,
    minimized: false,
    completedSteps: [],
    hasBaby: false,
    hasUpdate: false,
    effectiveSteps: [],
    allDone: false,
    tourBaby: null,
    activeCoachmarkStepId: null,
    restartHintVisible: false,
  });

  clearAuthQueryCache(queryClient);

  expect(queryClient.getQueryData(convexQuery(api.profile.get, {}).queryKey)).toBeUndefined();
  expect(queryClient.getQueryData(convexQuery(api.baby.listByUser, {}).queryKey)).toBeUndefined();
  expect(
    queryClient.getQueryData(convexQuery(api.onboarding.getMine, {}).queryKey),
  ).toBeUndefined();
});
