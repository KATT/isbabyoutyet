import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";

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

// --- Timeline rollback (down-migrations) ---
// Drains the data written by the timeline feature so a follow-up PR can
// remove the tables and the `timelineItemId` field from the schema. The
// schema itself MUST stay declared while these run: the deploy pushes the
// schema before running migrations, and Convex rejects a schema that drops
// a field existing documents still carry.

// Unset the timeline pointer on every encouragement
export const rollbackEncouragementPointers = migrations.define({
  table: "encouragements",
  migrateOne: async (ctx, encouragement) => {
    if (encouragement.timelineItemId === undefined) return;
    await ctx.db.patch(encouragement._id, { timelineItemId: undefined });
  },
});

// Delete all owner update rows
export const rollbackUpdates = migrations.define({
  table: "updates",
  migrateOne: async (ctx, update) => {
    await ctx.db.delete(update._id);
  },
});

// Delete all timeline rows
export const rollbackTimelineItems = migrations.define({
  table: "timelineItems",
  migrateOne: async (ctx, timelineItem) => {
    await ctx.db.delete(timelineItem._id);
  },
});

// Run all pending migrations - called automatically during deployment
// When adding migrations, import `internal` from "./_generated/api" and add references:
export const runAll = migrations.runner([
  internal.migrations.generateThumbnailsForExistingPhotos,
  internal.migrations.rollbackEncouragementPointers,
  internal.migrations.rollbackUpdates,
  internal.migrations.rollbackTimelineItems,
]);
