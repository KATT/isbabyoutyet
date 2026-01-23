"use node";

import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import sharp from "sharp";

// Generate thumbnail from a photo storage ID and update the baby record
export const generateThumbnail = internalAction({
  args: {
    babyId: v.id("baby"),
    photoId: v.id("_storage"),
  },
  handler: async (ctx: ActionCtx, args) => {

    // Download the original image
    const imageBlob = await ctx.storage.get(args.photoId);
    if (!imageBlob) {
      throw new Error("Photo not found in storage");
    }

    // Convert blob to buffer
    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Resize image to 900x300px with cover fit (maintains aspect ratio, crops to fit)
    const thumbnailBuffer = await sharp(buffer)
      .resize(900, 900, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Upload thumbnail back to storage
    const thumbnailId = await ctx.storage.store(
      new Blob([new Uint8Array(thumbnailBuffer)], { type: "image/jpeg" }),
    );

    // Update the baby record with the thumbnail ID
    await ctx.runMutation(internal.baby.updateThumbnail, {
      babyId: args.babyId,
      thumbnailId,
    });

    return thumbnailId;
  },
});
