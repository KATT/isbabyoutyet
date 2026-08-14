import { convexQuery } from "@convex-dev/react-query";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { TIMELINE_PAGE_SIZE } from "@/components/baby/timeline";

/** Public baby page by publicId (or legacy Convex id). */
export const babyByPublicId = (input: { id: string }) => convexQuery(api.baby.getByPublicId, input);

/** Signed-in user's babies for the dashboard. */
export const babiesByUser = () => convexQuery(api.baby.listByUser, {});

/** Current user's profile (null when anonymous). */
export const profileGet = () => convexQuery(api.profile.get, {});

/** Onboarding checklist / tour progress for the signed-in user. */
export const onboardingGetMine = () => convexQuery(api.onboarding.getMine, {});

/** Viewer access to a baby (owner / co-parent / neither). */
export const coParentsMyAccess = (input: { babyId: Id<"baby"> }) =>
  convexQuery(api.coParents.myAccess, input);

/** Co-parent list + pending invites (managers only). */
export const coParentsListForBaby = (input: { babyId: Id<"baby"> }) =>
  convexQuery(api.coParents.listForBaby, input);

/** Latest update blurb for the status card. */
export const timelineLatestUpdate = (input: { babyId: Id<"baby"> }) =>
  convexQuery(api.timeline.latestUpdate, input);

/** First page of the interleaved timeline feed. */
export const timelineFirstPage = (input: { babyId: Id<"baby"> }) =>
  convexQuery(api.timeline.listByBaby, {
    babyId: input.babyId,
    paginationOpts: { numItems: TIMELINE_PAGE_SIZE, cursor: null },
  });

/** VAPID public key for push subscription. */
export const pushPublicKey = () => convexQuery(api.pushSubscriptions.getPublicKey, {});

/** Whether this browser endpoint is subscribed for a baby. */
export const pushIsSubscribed = (input: { babyId: Id<"baby">; endpoint: string }) =>
  convexQuery(api.pushSubscriptions.isSubscribed, input);

/** Push subscription rows for a baby (managers). */
export const pushSubscriptionsForBaby = (input: { babyId: Id<"baby"> }) =>
  convexQuery(api.pushSubscriptions.getSubscriptions, input);

/** Pending/sent scheduled notification toasts (managers). */
export const scheduledNotificationsForBaby = (input: { babyId: Id<"baby"> }) =>
  convexQuery(api.baby.getScheduledNotifications, input);
