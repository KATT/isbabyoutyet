import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  extractEncouragementImageIds,
  resolveEncouragementImageMarkdown,
} from "../src/encouragementMarkdown";

const MAX_NAME_LENGTH = 50;
const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isWithinEditWindow(createdAt: number): boolean {
  return Date.now() - createdAt < EDIT_WINDOW_MS;
}

async function getEncouragementImageUrls(opts: {
  ctx: MutationCtx | QueryCtx;
  imageIds: string[];
}) {
  const imageUrls = Object.fromEntries(
    await Promise.all(
      opts.imageIds.map(async (imageId) => {
        const imageUrl = await opts.ctx.storage.getUrl(imageId as Id<"_storage">);
        return [imageId, imageUrl];
      }),
    ),
  );

  return imageUrls;
}

export const create = mutation({
  args: {
    babyId: v.id("baby"),
    authorName: v.string(),
    message: v.string(),
    visitorId: v.string(),
    userAgent: v.optional(v.string()),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate baby exists
    const baby = await ctx.db.get(args.babyId);
    if (!baby) {
      throw new Error("Baby not found");
    }

    // Check if encouragements are enabled
    if (baby.encouragementsDisabled) {
      throw new Error("Encouragements are disabled for this baby");
    }

    // Validate author name
    const trimmedName = args.authorName.trim();
    if (trimmedName.length === 0) {
      throw new Error("Name is required");
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      throw new Error(`Name must be ${MAX_NAME_LENGTH} characters or less`);
    }

    // Validate message
    const trimmedMessage = args.message.trim();
    if (trimmedMessage.length === 0) {
      throw new Error("Message is required");
    }

    const encouragementId = await ctx.db.insert("encouragements", {
      babyId: args.babyId,
      authorName: trimmedName,
      message: trimmedMessage,
      createdAt: Date.now(),
      visitorId: args.visitorId,
      userAgent: args.userAgent,
      locale: args.locale,
      timezone: args.timezone,
    });

    return encouragementId;
  },
});

export const update = mutation({
  args: {
    encouragementId: v.id("encouragements"),
    visitorId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const encouragement = await ctx.db.get(args.encouragementId);
    if (!encouragement) {
      throw new Error("Encouragement not found");
    }

    // Validate visitor ID matches
    if (encouragement.visitorId !== args.visitorId) {
      throw new Error("Not authorized to edit this encouragement");
    }

    // Validate within edit window
    if (!isWithinEditWindow(encouragement.createdAt)) {
      throw new Error("Edit window has expired (15 minutes)");
    }

    // Validate message
    const trimmedMessage = args.message.trim();
    if (trimmedMessage.length === 0) {
      throw new Error("Message is required");
    }

    const existingImageIds = new Set(extractEncouragementImageIds(encouragement.message));
    const nextImageIds = new Set(extractEncouragementImageIds(trimmedMessage));

    await ctx.db.patch(args.encouragementId, {
      message: trimmedMessage,
    });

    for (const imageId of existingImageIds) {
      if (!nextImageIds.has(imageId)) {
        await ctx.storage.delete(imageId as Id<"_storage">);
      }
    }
  },
});

export const listByBaby = query({
  args: {
    babyId: v.id("baby"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("encouragements")
      .withIndex("by_babyId", (q) => q.eq("babyId", args.babyId))
      .order("desc")
      .paginate(args.paginationOpts);

    const imageIds = new Set<string>();
    for (const encouragement of page.page) {
      for (const imageId of extractEncouragementImageIds(encouragement.message)) {
        imageIds.add(imageId);
      }
    }

    const imageUrls = await getEncouragementImageUrls({
      ctx,
      imageIds: [...imageIds],
    });

    return {
      ...page,
      page: page.page.map((encouragement) => ({
        ...encouragement,
        renderedMessage: resolveEncouragementImageMarkdown({
          markdown: encouragement.message,
          imageUrls,
        }),
      })),
    };
  },
});

export const generateImageUploadUrl = mutation({
  args: {
    babyId: v.id("baby"),
  },
  handler: async (ctx, args) => {
    const baby = await ctx.db.get(args.babyId);
    if (!baby) {
      throw new Error("Baby not found");
    }

    if (baby.encouragementsDisabled) {
      throw new Error("Encouragements are disabled for this baby");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const getImageUrls = query({
  args: {
    imageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    return await getEncouragementImageUrls({
      ctx,
      imageIds: args.imageIds,
    });
  },
});

export const remove = mutation({
  args: {
    encouragementId: v.id("encouragements"),
    visitorId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const encouragement = await ctx.db.get(args.encouragementId);
    if (!encouragement) {
      throw new Error("Encouragement not found");
    }

    const baby = await ctx.db.get(encouragement.babyId);
    if (!baby) {
      throw new Error("Baby not found");
    }

    // Check if user is the baby's owner (authenticated)
    const identity = await ctx.auth.getUserIdentity();
    const isOwner = identity && baby.userId === identity.subject;

    // Check if visitor can delete (matches visitorId and within time window)
    const canVisitorDelete =
      args.visitorId &&
      encouragement.visitorId === args.visitorId &&
      isWithinEditWindow(encouragement.createdAt);

    if (!isOwner && !canVisitorDelete) {
      throw new Error("Not authorized to delete this encouragement");
    }

    for (const imageId of extractEncouragementImageIds(encouragement.message)) {
      await ctx.storage.delete(imageId as Id<"_storage">);
    }

    await ctx.db.delete(args.encouragementId);
  },
});
