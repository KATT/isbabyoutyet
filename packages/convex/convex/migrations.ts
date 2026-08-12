import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Milestone } from "../src/types";
import { MILESTONE_FIELDS, MILESTONES } from "../src/types";
import {
  findMilestoneUpdate,
  insertEncouragementTimelineItem,
  insertUpdateWithTimelineItem,
} from "./timeline";

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
    .collect();

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

    const existing = await findMilestoneUpdate(ctx, baby._id, milestone);
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
      .collect();
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
 * One-shot: promote a specific encouragement (by id) into an owner timeline
 * update at the same `postedAt`, then delete the encouragement + its timeline
 * row. Copies the message from the source doc — do not hardcode message text.
 * Idempotent: missing source id is a no-op.
 */
export async function convertEncouragementToOwnerUpdate(
  ctx: MutationCtx,
  encouragementId: Id<"encouragements">,
) {
  const encouragement = await ctx.db.get(encouragementId);
  if (!encouragement) return;

  await insertUpdateWithTimelineItem(ctx, {
    babyId: encouragement.babyId,
    postedAt: encouragement.createdAt,
    message: encouragement.message,
  });

  const timelineItemId = encouragement.timelineItemId;
  await ctx.db.delete(encouragement._id);
  if (timelineItemId) {
    await ctx.db.delete(timelineItemId);
  }
}

/** Alma page: Steph's post-birth thank-you encouragement → family update. */
const ALMA_STEPH_ENCOURAGEMENT_ID = "js75t2xs6hv3j7p4cbmp7nbj5d7z4axz" as Id<"encouragements">;

export const convertAlmaStephEncouragementToUpdate = migrations.define({
  table: "encouragements",
  migrateOne: async (ctx, encouragement) => {
    if (encouragement._id !== ALMA_STEPH_ENCOURAGEMENT_ID) return;
    await convertEncouragementToOwnerUpdate(ctx, encouragement._id);
  },
});

// Run all pending migrations - called automatically during deployment
export const runAll = migrations.runner([
  internal.migrations.generateThumbnailsForExistingPhotos,
  internal.migrations.backfillBabyTimeline,
  internal.migrations.backfillEncouragementTimeline,
  internal.migrations.separateMilestoneOccurredAt,
  internal.migrations.convertAlmaStephEncouragementToUpdate,
]);
