import { expect, test } from "vitest";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import {
  adminBabiesInfinite,
  adminLanguageRequestsInfinite,
  babiesByUser,
  babyByPublicId,
  coParentsListForBaby,
  coParentsMyAccess,
  onboardingGetMine,
  profileGet,
  pushIsSubscribed,
  pushPublicKey,
  pushSubscriptionsForBaby,
  scheduledNotificationsForBaby,
  timelineByBaby,
  timelineLatestUpdate,
} from "./convex";
import { CONVEX_INFINITE_QUERY_KEY } from "@/lib/convexInfiniteQuery";

test("convex query factories build stable query keys", () => {
  const babyId = "jd7baby000000000000000000" as Id<"baby">;

  expect(babyByPublicId({ id: "demo" }).queryKey).toBeDefined();
  expect(babiesByUser().queryKey).toBeDefined();
  expect(profileGet().queryKey).toBeDefined();
  expect(onboardingGetMine().queryKey).toBeDefined();
  expect(coParentsMyAccess({ babyId }).queryKey).toBeDefined();
  expect(coParentsListForBaby({ babyId }).queryKey).toBeDefined();
  expect(timelineLatestUpdate({ babyId }).queryKey).toBeDefined();
  expect(timelineByBaby({ babyId, visitorId: undefined }).queryKey[0]).toBe(
    CONVEX_INFINITE_QUERY_KEY,
  );
  expect(
    adminBabiesInfinite({ sortBy: "updated", sortOrder: "desc", hideDemo: true }).queryKey[0],
  ).toBe(CONVEX_INFINITE_QUERY_KEY);
  expect(adminLanguageRequestsInfinite().queryKey[0]).toBe(CONVEX_INFINITE_QUERY_KEY);
  expect(pushPublicKey().queryKey).toBeDefined();
  expect(pushIsSubscribed({ babyId, endpoint: "https://push.example" }).queryKey).toBeDefined();
  expect(pushSubscriptionsForBaby({ babyId }).queryKey).toBeDefined();
  expect(scheduledNotificationsForBaby({ babyId }).queryKey).toBeDefined();
});
