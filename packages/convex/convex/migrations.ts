import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Milestone } from "../src/types";
import { MILESTONE_FIELDS, MILESTONES } from "../src/types";
import { isOnboardingStepId } from "../src/onboardingSteps";
import {
  findMilestoneUpdate,
  insertEncouragementTimelineItem,
  insertUpdateWithTimelineItem,
} from "./timeline";
import { tokenIdentifierForAuthUserId } from "./authIdentity";
import { markUserOnboardingComplete, SKIP_TOUR_FOR_EXISTING_USERS_SENTINEL } from "./onboarding";
import { isActive } from "./softDelete";
import { DEMO_EMPTY_USER } from "../src/seedCredentials";

export const migrations = new Migrations<DataModel>(components.migrations);

// Runner to execute individual migrations via CLI
export const run = migrations.runner();

// Migration to generate thumbnails for existing photos
export const generateThumbnailsForExistingPhotos = migrations.define({
  table: "baby",
  migrateOne: async (ctx, baby) => {
    // Only process babies that have a photo but no thumbnail
    if (baby.photoId && !baby.thumbnailId) {
      // Schedule thumbnail generation action
      await ctx.scheduler.runAfter(0, internal.babyThumbnails.generateThumbnail, {
        babyId: baby._id,
        photoId: baby.photoId,
      });
    }
  },
});

/**
 * Best-effort "when this milestone was announced" timestamp: the notification
 * for this milestone whose `createdAt` is closest to `referenceMs` (usually the
 * update row's `_creationTime`). Preferring closest — not earliest — avoids
 * picking a stale cancelled notification from a prior unmark/remark cycle.
 * Falls back to `fallbackMs` when no matching notification exists.
 */
export async function resolveMilestoneAnnounceAt(
  ctx: MutationCtx,
  opts: {
    babyId: Id<"baby">;
    milestone: Milestone;
    referenceMs: number;
    fallbackMs: number;
  },
) {
  const notifications = await ctx.db
    .query("scheduledNotifications")
    .withIndex("by_babyId", (q) => q.eq("babyId", opts.babyId))
    .order("desc")
    .take(256);

  let bestCreatedAt: number | null = null;
  let bestDistance = Infinity;
  for (const notification of notifications) {
    if (notification.notificationType !== opts.milestone) continue;
    const distance = Math.abs(notification.createdAt - opts.referenceMs);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCreatedAt = notification.createdAt;
    }
  }
  return bestCreatedAt ?? opts.fallbackMs;
}

function parseIsoMs(iso: string | null | undefined) {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Backfills the timeline with a baby's existing milestones and its current
 * photo. Milestone rows land at announce time (`postedAt`) with the event
 * clock on `occurredAt`.
 *
 * Idempotent PER ITEM (not per baby): dual-writes go live before `runAll`
 * runs during a deploy, so a baby may already have some rows — each missing
 * milestone/photo is still backfilled individually.
 */
export async function backfillBabyTimelineDoc(ctx: MutationCtx, baby: Doc<"baby">) {
  for (const milestone of MILESTONES) {
    const fields = MILESTONE_FIELDS[milestone];
    const isoDate = baby[fields.date];
    if (!isoDate) continue;

    const existing = await findMilestoneUpdate(ctx, { babyId: baby._id, milestone: milestone });
    if (existing) continue;

    const occurredAt = parseIsoMs(isoDate) ?? Date.now();
    const now = Date.now();
    const postedAt = await resolveMilestoneAnnounceAt(ctx, {
      babyId: baby._id,
      milestone,
      // No update row yet — prefer the notification closest to "now" (latest cycle)
      referenceMs: now,
      fallbackMs: now,
    });
    await insertUpdateWithTimelineItem(ctx, {
      babyId: baby._id,
      postedAt,
      occurredAt,
      milestone,
      message: baby[fields.message] ?? null,
    });
  }

  if (baby.photoId) {
    const existingUpdates = await ctx.db
      .query("updates")
      .withIndex("by_babyId", (q) => q.eq("babyId", baby._id))
      .order("desc")
      .take(256);
    const currentPhotoAlreadyInFeed = existingUpdates.some(
      (update) => update.photoId === baby.photoId,
    );

    if (!currentPhotoAlreadyInFeed) {
      // The storage file's _creationTime is the original upload time — use it
      // as the historical postedAt so the photo lands where it actually
      // happened in the feed, not at migration time.
      const fileMetadata = await ctx.db.system.get(baby.photoId);
      const { updateId } = await insertUpdateWithTimelineItem(ctx, {
        babyId: baby._id,
        postedAt: fileMetadata?._creationTime ?? Date.now(),
        photoId: baby.photoId,
        thumbnailId: baby.thumbnailId ?? null,
      });
      if (!baby.thumbnailId) {
        await ctx.scheduler.runAfter(0, internal.babyThumbnails.generateThumbnail, {
          babyId: baby._id,
          photoId: baby.photoId,
          updateId,
        });
      }
    }
  }
}

export const backfillBabyTimeline = migrations.define({
  table: "baby",
  migrateOne: backfillBabyTimelineDoc,
});

/**
 * Backfills the timeline row for an existing encouragement at its original
 * creation time. Idempotent: an encouragement with `timelineItemId` set has
 * already been migrated.
 */
export async function backfillEncouragementTimelineDoc(
  ctx: MutationCtx,
  encouragement: Doc<"encouragements">,
) {
  if (encouragement.timelineItemId) return;

  const timelineItemId = await insertEncouragementTimelineItem(ctx, {
    babyId: encouragement.babyId,
    postedAt: encouragement.createdAt,
  });
  await ctx.db.patch(encouragement._id, { timelineItemId });
}

export const backfillEncouragementTimeline = migrations.define({
  table: "encouragements",
  migrateOne: backfillEncouragementTimelineDoc,
});

/**
 * Splits milestone event time from feed position on existing rows:
 * - `occurredAt` ← baby date field (when it happened)
 * - `postedAt` ← announce time when the row still looks backdated
 *
 * Idempotent: once `postedAt` matches announce time (or no longer looks like
 * the event clock), re-runs are a no-op. Having `occurredAt` already set does
 * NOT skip the feed repair — a redate during the deploy window can set
 * `occurredAt` while leaving a legacy event-clock `postedAt`.
 */
export async function separateMilestoneOccurredAtDoc(ctx: MutationCtx, update: Doc<"updates">) {
  if (!update.milestone) return;

  const baby = await ctx.db.get(update.babyId);
  if (!baby) return;

  const item = await ctx.db.get(update.timelineItemId);
  if (!item) return;

  const fields = MILESTONE_FIELDS[update.milestone];
  const occurredAt = parseIsoMs(baby[fields.date]);
  if (occurredAt == null) {
    if (update.occurredAt == null) {
      await ctx.db.patch(update._id, { occurredAt: item.postedAt });
    }
    return;
  }

  if (update.occurredAt !== occurredAt) {
    await ctx.db.patch(update._id, { occurredAt });
  }

  const announceAt = await resolveMilestoneAnnounceAt(ctx, {
    babyId: update.babyId,
    milestone: update.milestone,
    referenceMs: update._creationTime,
    fallbackMs: update._creationTime,
  });

  // Already at announce time — done
  if (Math.abs(item.postedAt - announceAt) <= 1000) return;

  const looksLikeEventClock = Math.abs(item.postedAt - occurredAt) <= 1000;
  // Redate-during-deploy: postedAt stuck on an older event clock, far from both
  // the current baby date and the row's creation / announce time
  const looksLikeStaleEventClock =
    Math.abs(item.postedAt - update._creationTime) > 60_000 &&
    Math.abs(item.postedAt - occurredAt) > 1000;

  if (!looksLikeEventClock && !looksLikeStaleEventClock) return;

  await ctx.db.patch(item._id, { postedAt: announceAt });
}

export const separateMilestoneOccurredAt = migrations.define({
  table: "updates",
  migrateOne: separateMilestoneOccurredAtDoc,
});

/**
 * Clears the legacy per-stage message fields — but a field is only nulled
 * once its value has a PROVEN durable destination on the milestone's timeline
 * update row (healing the row if the backfill missed it). Fields whose value
 * has nowhere to live are left intact rather than destroyed:
 *
 * - a message for an unmarked stage (old Settings allowed prepping messages
 *   for future stages) — no row exists and creating a public update for a
 *   stage that never happened would be wrong
 * - a message that differs from the row's existing message (the row was
 *   edited since; the legacy value is superseded but not represented)
 *
 * Idempotent: cleared fields are skipped on re-runs; retained fields are
 * re-evaluated (and stay retained until they gain a destination).
 */
export async function clearLegacyStageMessagesDoc(ctx: MutationCtx, baby: Doc<"baby">) {
  const patch: Partial<
    Pick<Doc<"baby">, "laborStartedMessage" | "hospitalMessage" | "babyBornMessage">
  > = {};

  for (const milestone of MILESTONES) {
    const fields = MILESTONE_FIELDS[milestone];
    const legacyMessage = baby[fields.message];
    if (legacyMessage == null) continue;

    // No milestone date → no timeline row to carry the message. Keep it.
    if (!baby[fields.date]) continue;

    const existing = await findMilestoneUpdate(ctx, { babyId: baby._id, milestone: milestone });
    if (!existing) {
      // Heal like backfillBabyTimelineDoc: announce time on the feed clock,
      // event time on occurredAt
      const occurredAt = parseIsoMs(baby[fields.date]) ?? Date.now();
      const now = Date.now();
      const postedAt = await resolveMilestoneAnnounceAt(ctx, {
        babyId: baby._id,
        milestone,
        referenceMs: now,
        fallbackMs: now,
      });
      await insertUpdateWithTimelineItem(ctx, {
        babyId: baby._id,
        postedAt,
        occurredAt,
        milestone,
        message: legacyMessage,
      });
    } else if (existing.message == null) {
      await ctx.db.patch(existing._id, { message: legacyMessage });
    } else if (existing.message !== legacyMessage) {
      // The row carries a different message; the legacy value has no durable
      // destination. Keep the field.
      continue;
    }

    patch[fields.message] = null;
  }

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(baby._id, patch);
  }
}

export const clearLegacyStageMessages = migrations.define({
  table: "baby",
  // Each document can heal rows + scan notifications; keep batches small so a
  // batch (one transaction) stays far from Convex transaction limits.
  batchSize: 10,
  migrateOne: clearLegacyStageMessagesDoc,
});

const SKIP_TOUR_BATCH_SIZE = 50;

function authUserId(user: unknown) {
  if (user && typeof user === "object" && "_id" in user) {
    return String(user._id);
  }
  throw new Error("Better Auth user is missing _id");
}

function authUserEmail(user: unknown) {
  if (user && typeof user === "object" && "email" in user && typeof user.email === "string") {
    return user.email;
  }
  return null;
}

/**
 * Grandfathers every Better Auth user that existed when the guided tour
 * shipped: they skip the welcome carousel and checklist. New signups after
 * this migration completes still get the tour.
 *
 * The empty demo login (`test+newuser@example.com`) is left on the first-run
 * tour so preview/local can exercise that flow. `seedDemoData` resets that
 * account's progress and marks the main demo parent as complete.
 *
 * Idempotent: a sentinel `userOnboarding` row is written on the last page,
 * so later `runAll` deploys are a no-op.
 */
export async function skipTourForExistingUsersPage(ctx: MutationCtx, cursor: string | null) {
  const sentinel = await ctx.db
    .query("userOnboarding")
    .withIndex("by_userId", (q) => q.eq("userId", SKIP_TOUR_FOR_EXISTING_USERS_SENTINEL))
    .unique();
  if (sentinel) {
    return {
      isDone: true,
      continueCursor: "",
      alreadyRan: true,
      processed: 0,
    };
  }

  const page = await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "user",
    paginationOpts: {
      numItems: SKIP_TOUR_BATCH_SIZE,
      cursor,
    },
  });

  for (const user of page.page) {
    if (authUserEmail(user) === DEMO_EMPTY_USER.email) continue;
    await markUserOnboardingComplete(ctx, authUserId(user));
  }

  if (page.isDone) {
    await markUserOnboardingComplete(ctx, SKIP_TOUR_FOR_EXISTING_USERS_SENTINEL);
    return {
      isDone: true,
      continueCursor: page.continueCursor,
      alreadyRan: false,
      processed: page.page.length,
    };
  }

  return {
    isDone: false,
    continueCursor: page.continueCursor,
    alreadyRan: false,
    processed: page.page.length,
  };
}

export const skipTourForExistingUsers = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const result = await skipTourForExistingUsersPage(ctx, args.cursor);
    if (!result.isDone && !result.alreadyRan) {
      await ctx.scheduler.runAfter(0, internal.migrations.skipTourForExistingUsers, {
        cursor: result.continueCursor,
      });
    }
    return result;
  },
});

/**
 * Prefills `postedByUserId` on existing updates from the baby owner so a later
 * PR can tighten the field to required.
 */
export async function backfillUpdatePostedByUserIdDoc(ctx: MutationCtx, update: Doc<"updates">) {
  if (update.postedByUserId != null) return;
  const baby = await ctx.db.get(update.babyId);
  if (!baby) return;
  await ctx.db.patch(update._id, { postedByUserId: baby.userId });
}

export const backfillUpdatePostedByUserId = migrations.define({
  table: "updates",
  migrateOne: backfillUpdatePostedByUserIdDoc,
});

export async function backfillBabyOwnerTokenIdentifierDoc(ctx: MutationCtx, baby: Doc<"baby">) {
  if (baby.ownerTokenIdentifier !== undefined) return;
  await ctx.db.patch(baby._id, {
    ownerTokenIdentifier: tokenIdentifierForAuthUserId(baby.userId),
  });
}

export const backfillBabyOwnerTokenIdentifier = migrations.define({
  table: "baby",
  migrateOne: backfillBabyOwnerTokenIdentifierDoc,
});

export async function backfillBabyLastActivityAtDoc(ctx: MutationCtx, baby: Doc<"baby">) {
  if (baby.lastActivityAt !== undefined) return;
  const timelineItems = await ctx.db
    .query("timelineItems")
    .withIndex("by_babyId_and_postedAt", (q) => q.eq("babyId", baby._id))
    .order("desc")
    .take(256);
  const latest = timelineItems.find(isActive);
  await ctx.db.patch(baby._id, {
    lastActivityAt: Math.max(baby._creationTime, latest?.postedAt ?? baby._creationTime),
  });
}

export const backfillBabyLastActivityAt = migrations.define({
  table: "baby",
  migrateOne: backfillBabyLastActivityAtDoc,
});

export async function backfillBabySubscriptionCountDoc(ctx: MutationCtx, baby: Doc<"baby">) {
  let subscriptionCount = 0;
  for await (const _subscription of ctx.db
    .query("pushSubscriptions")
    .withIndex("by_babyId", (q) => q.eq("babyId", baby._id))) {
    subscriptionCount += 1;
  }
  await ctx.db.patch(baby._id, { subscriptionCount });
}

export const backfillBabySubscriptionCount = migrations.define({
  table: "baby",
  migrateOne: backfillBabySubscriptionCountDoc,
});

export async function backfillProfileTokenIdentifierDoc(
  ctx: MutationCtx,
  profile: Doc<"userProfiles">,
) {
  if (profile.tokenIdentifier !== undefined) return;
  await ctx.db.patch(profile._id, {
    tokenIdentifier: tokenIdentifierForAuthUserId(profile.userId),
  });
}

export const backfillProfileTokenIdentifier = migrations.define({
  table: "userProfiles",
  migrateOne: backfillProfileTokenIdentifierDoc,
});

export async function backfillOnboardingTokenIdentifierDoc(
  ctx: MutationCtx,
  onboarding: Doc<"userOnboarding">,
) {
  if (onboarding.tokenIdentifier !== undefined) return;
  await ctx.db.patch(onboarding._id, {
    tokenIdentifier: tokenIdentifierForAuthUserId(onboarding.userId),
  });
}

export const backfillOnboardingTokenIdentifier = migrations.define({
  table: "userOnboarding",
  migrateOne: backfillOnboardingTokenIdentifierDoc,
});

export async function backfillCoParentTokenIdentifierDoc(
  ctx: MutationCtx,
  coParent: Doc<"babyCoParents">,
) {
  if (coParent.tokenIdentifier !== undefined) return;
  await ctx.db.patch(coParent._id, {
    tokenIdentifier: tokenIdentifierForAuthUserId(coParent.userId),
  });
}

export const backfillCoParentTokenIdentifier = migrations.define({
  table: "babyCoParents",
  migrateOne: backfillCoParentTokenIdentifierDoc,
});

export async function sanitizeOnboardingStepsDoc(
  ctx: MutationCtx,
  onboarding: Doc<"userOnboarding">,
) {
  const completedSteps = onboarding.completedSteps.filter(isOnboardingStepId);
  if (completedSteps.length === onboarding.completedSteps.length) return;
  await ctx.db.patch(onboarding._id, { completedSteps });
}

export const sanitizeOnboardingSteps = migrations.define({
  table: "userOnboarding",
  migrateOne: sanitizeOnboardingStepsDoc,
});

/**
 * Prefills `isAdmin: false` on existing userProfiles so a later PR can tighten
 * the field to required.
 */
export async function backfillUserProfileIsAdminDoc(
  ctx: MutationCtx,
  profile: Doc<"userProfiles">,
) {
  if (profile.isAdmin !== undefined) return;
  await ctx.db.patch(profile._id, { isAdmin: false });
}

export const backfillUserProfileIsAdmin = migrations.define({
  table: "userProfiles",
  migrateOne: backfillUserProfileIsAdminDoc,
});

export const runTableMigrations = migrations.runner([
  internal.migrations.generateThumbnailsForExistingPhotos,
  internal.migrations.backfillBabyTimeline,
  internal.migrations.backfillEncouragementTimeline,
  internal.migrations.separateMilestoneOccurredAt,
  internal.migrations.clearLegacyStageMessages,
  internal.migrations.backfillUpdatePostedByUserId,
  internal.migrations.backfillBabyOwnerTokenIdentifier,
  internal.migrations.backfillBabyLastActivityAt,
  internal.migrations.backfillBabySubscriptionCount,
  internal.migrations.backfillProfileTokenIdentifier,
  internal.migrations.backfillOnboardingTokenIdentifier,
  internal.migrations.backfillCoParentTokenIdentifier,
  internal.migrations.sanitizeOnboardingSteps,
  internal.migrations.backfillUserProfileIsAdmin,
]);

const TABLE_MIGRATION_NAMES = [
  "migrations:generateThumbnailsForExistingPhotos",
  "migrations:backfillBabyTimeline",
  "migrations:backfillEncouragementTimeline",
  "migrations:separateMilestoneOccurredAt",
  "migrations:clearLegacyStageMessages",
  "migrations:backfillUpdatePostedByUserId",
  "migrations:backfillBabyOwnerTokenIdentifier",
  "migrations:backfillBabyLastActivityAt",
  "migrations:backfillBabySubscriptionCount",
  "migrations:backfillProfileTokenIdentifier",
  "migrations:backfillOnboardingTokenIdentifier",
  "migrations:backfillCoParentTokenIdentifier",
  "migrations:sanitizeOnboardingSteps",
  "migrations:backfillUserProfileIsAdmin",
] as const;

export const deploymentStatus = internalQuery({
  args: {},
  handler: async (ctx): Promise<{ isDone: boolean; failed: string[] }> => {
    const statuses = await migrations.getStatus(ctx, {
      migrations: [...TABLE_MIGRATION_NAMES],
    });
    return {
      isDone:
        statuses.length === TABLE_MIGRATION_NAMES.length &&
        statuses.every((status) => status.isDone),
      failed: statuses
        .filter((status) => status.error !== undefined)
        .map((status) => `${status.name}: ${status.error}`),
    };
  },
});

// Run all pending migrations - called automatically during deployment.
// skipTourForExistingUsers is not a table walker (users live in the Better
// Auth component), so it is kicked off alongside the serial table series.
export const runAll = internalMutation({
  args: {
    fn: v.optional(v.string()),
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
    next: v.optional(v.array(v.string())),
    reset: v.optional(v.boolean()),
    oneBatchOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    await ctx.scheduler.runAfter(0, internal.migrations.skipTourForExistingUsers, {
      cursor: null,
    });
    return await ctx.runMutation(internal.migrations.runTableMigrations, args);
  },
});
