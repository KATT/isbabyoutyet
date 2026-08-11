import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { MILESTONE_FIELDS, MILESTONES } from "../src/types";
import { insertEncouragementTimelineItem, insertUpdateWithTimelineItem } from "./timeline";

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
 * Idempotent: skips babies that already have update rows.
 */
export async function backfillBabyTimelineDoc(ctx: MutationCtx, baby: Doc<"baby">) {
  const existingUpdate = await ctx.db
    .query("updates")
    .withIndex("by_babyId", (q) => q.eq("babyId", baby._id))
    .first();
  if (existingUpdate) return;

  for (const milestone of MILESTONES) {
    const fields = MILESTONE_FIELDS[milestone];
    const isoDate = baby[fields.date];
    if (!isoDate) continue;

    const parsed = Date.parse(isoDate);
    await insertUpdateWithTimelineItem(ctx, {
      babyId: baby._id,
      postedAt: Number.isNaN(parsed) ? Date.now() : parsed,
      milestone,
      message: baby[fields.message] ?? null,
    });
  }

  if (baby.photoId) {
    // The original upload date isn't stored anywhere; use "now" so the
    // current photo lands at the top of the backfilled feed.
    const { updateId } = await insertUpdateWithTimelineItem(ctx, {
      babyId: baby._id,
      postedAt: Date.now(),
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
