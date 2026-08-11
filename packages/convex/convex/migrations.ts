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

// Run all pending migrations - called automatically during deployment
// When adding migrations, import `internal` from "./_generated/api" and add references:
export const runAll = migrations.runner([internal.migrations.generateThumbnailsForExistingPhotos]);
