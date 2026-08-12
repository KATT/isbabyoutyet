import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
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
 * Backfills the timeline with a baby's existing milestones (using their
 * historical dates and legacy per-stage messages) and its current photo.
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

    const parsed = Date.parse(isoDate);
    await insertUpdateWithTimelineItem(ctx, {
      babyId: baby._id,
      postedAt: Number.isNaN(parsed) ? Date.now() : parsed,
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

// Run all pending migrations - called automatically during deployment
// When adding migrations, import `internal` from "./_generated/api" and add references:
export const runAll = migrations.runner([
  internal.migrations.generateThumbnailsForExistingPhotos,
  internal.migrations.backfillBabyTimeline,
  internal.migrations.backfillEncouragementTimeline,
]);
