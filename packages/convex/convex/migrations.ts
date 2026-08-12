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
 * Best-effort "when this milestone was announced" timestamp:
 * earliest scheduled-notification createdAt for that type, else the update's
 * _creationTime (live post or previous migration insert).
 */
export async function resolveMilestoneAnnounceAt(
  ctx: MutationCtx,
  opts: { babyId: Id<"baby">; milestone: Milestone; fallbackMs: number },
) {
  const notifications = await ctx.db
    .query("scheduledNotifications")
    .withIndex("by_babyId", (q) => q.eq("babyId", opts.babyId))
    .collect();
  let earliest: number | null = null;
  for (const notification of notifications) {
    if (notification.notificationType !== opts.milestone) continue;
    if (earliest === null || notification.createdAt < earliest) {
      earliest = notification.createdAt;
    }
  }
  return earliest ?? opts.fallbackMs;
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
    const postedAt = await resolveMilestoneAnnounceAt(ctx, {
      babyId: baby._id,
      milestone,
      fallbackMs: Date.now(),
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
 * - `postedAt` ← announce time (notification createdAt, else update creation)
 *   when the row was previously backdated to the event clock
 *
 * Idempotent: rows that already have `occurredAt` set are left alone.
 */
export async function separateMilestoneOccurredAtDoc(ctx: MutationCtx, update: Doc<"updates">) {
  if (!update.milestone) return;
  if (update.occurredAt != null) return;

  const baby = await ctx.db.get(update.babyId);
  if (!baby) return;

  const fields = MILESTONE_FIELDS[update.milestone];
  const occurredAt = parseIsoMs(baby[fields.date]);
  if (occurredAt == null) {
    // No canonical event date — treat current postedAt as the event clock
    const item = await ctx.db.get(update.timelineItemId);
    await ctx.db.patch(update._id, { occurredAt: item?.postedAt ?? update._creationTime });
    return;
  }

  await ctx.db.patch(update._id, { occurredAt });

  const item = await ctx.db.get(update.timelineItemId);
  if (!item) return;

  // Only rewrite feed position when it was clearly the backdated event clock
  // (within 1s of the baby date). Live posts already have announce-time postedAt.
  if (Math.abs(item.postedAt - occurredAt) > 1000) return;

  const postedAt = await resolveMilestoneAnnounceAt(ctx, {
    babyId: update.babyId,
    milestone: update.milestone,
    fallbackMs: update._creationTime,
  });
  if (postedAt !== item.postedAt) {
    await ctx.db.patch(item._id, { postedAt });
  }
}

export const separateMilestoneOccurredAt = migrations.define({
  table: "updates",
  migrateOne: separateMilestoneOccurredAtDoc,
});

// Run all pending migrations - called automatically during deployment
export const runAll = migrations.runner([
  internal.migrations.generateThumbnailsForExistingPhotos,
  internal.migrations.backfillBabyTimeline,
  internal.migrations.backfillEncouragementTimeline,
  internal.migrations.separateMilestoneOccurredAt,
]);
