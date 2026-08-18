"use node";

import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { renderPageThumbnail, renderPushImage } from "../src/photoDerivatives";

function jpegBlob(bytes: Uint8Array) {
  return new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
}

// Generate page thumbnail + push-notification image from a photo storage ID.
export const generateThumbnail = internalAction({
  args: {
    babyId: v.id("baby"),
    photoId: v.id("_storage"),
    updateId: v.optional(v.id("updates")),
  },
  handler: async (ctx: ActionCtx, args) => {
    const imageBlob = await ctx.storage.get(args.photoId);
    if (!imageBlob) {
      throw new Error("Photo not found in storage");
    }

    const bytes = new Uint8Array(await imageBlob.arrayBuffer());
    const thumbnailId = await ctx.storage.store(jpegBlob(await renderPageThumbnail(bytes)));
    const pushImageId = args.updateId
      ? await ctx.storage.store(jpegBlob(await renderPushImage(bytes)))
      : null;

    await ctx.runMutation(internal.baby.updateThumbnail, {
      babyId: args.babyId,
      thumbnailId,
      photoId: args.photoId,
      updateId: args.updateId,
      pushImageId,
    });

    return thumbnailId;
  },
});
