import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { deleteEncouragementWithTimelineItem, insertEncouragementTimelineItem } from "./timeline";
import { appIdentity } from "./authIdentity";
import { canManageBaby } from "./babyAccess";
import { resolveBabyPreferences } from "./babyPreferences";
import type { OwnerMessagePushEvent } from "../src/pushMessages";
import { isActive } from "./softDelete";
import { mutationWithTriggers } from "./triggers";

const MAX_NAME_LENGTH = 50;
const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isWithinEditWindow(createdAt: number): boolean {
  return Date.now() - createdAt < EDIT_WINDOW_MS;
}

async function scheduleOwnerEncouragementPush(
  ctx: MutationCtx,
  opts: {
    authorName: string;
    baby: Doc<"baby">;
    encouragementId: Id<"encouragements">;
    event: OwnerMessagePushEvent;
    message: string;
  },
) {
  const existing = await ctx.db
    .query("ownerPushSubscriptions")
    .withIndex("by_babyId", (q) => q.eq("babyId", opts.baby._id))
    .first();
  if (!existing) {
    return;
  }

  const preferences = await resolveBabyPreferences(ctx.db, opts.baby);
  await ctx.scheduler.runAfter(0, internal.pushNotifications.sendOwnerMessageNotification, {
    authorName: opts.authorName,
    babyId: opts.baby._id,
    babyName: opts.baby.name,
    encouragementId: opts.encouragementId,
    event: opts.event,
    locale: preferences.resolvedLocale,
    message: opts.message,
    publicId: opts.baby.publicId,
  });
}

async function scheduleOwnerEncouragementDismiss(
  ctx: MutationCtx,
  opts: { baby: Doc<"baby">; encouragementId: Id<"encouragements"> },
) {
  const existing = await ctx.db
    .query("ownerPushSubscriptions")
    .withIndex("by_babyId", (q) => q.eq("babyId", opts.baby._id))
    .first();
  if (!existing) {
    return;
  }

  await ctx.scheduler.runAfter(0, internal.pushNotifications.dismissOwnerMessageNotification, {
    babyId: opts.baby._id,
    encouragementId: opts.encouragementId,
  });
}

async function callerIsManager(ctx: MutationCtx, baby: Doc<"baby">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return false;
  }
  return await canManageBaby(ctx, { baby, identity: appIdentity(identity) });
}

export const create = mutationWithTriggers({
  args: {
    authorName: v.string(),
    babyId: v.id("baby"),
    locale: v.union(v.string(), v.null()),
    message: v.string(),
    timezone: v.union(v.string(), v.null()),
    userAgent: v.union(v.string(), v.null()),
    visitorId: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate baby exists and is not soft-deleted
    const baby = await ctx.db.get(args.babyId);
    if (!baby || !isActive(baby)) {
      throw new Error("Baby not found");
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

    const createdAt = Date.now();
    const timelineItemId = await insertEncouragementTimelineItem(ctx, {
      babyId: args.babyId,
      postedAt: createdAt,
    });
    const encouragementId = await ctx.db.insert("encouragements", {
      authorName: trimmedName,
      babyId: args.babyId,
      createdAt,
      locale: args.locale,
      message: trimmedMessage,
      timelineItemId,
      timezone: args.timezone,
      userAgent: args.userAgent,
      visitorId: args.visitorId,
    });

    if (!(await callerIsManager(ctx, baby))) {
      await scheduleOwnerEncouragementPush(ctx, {
        authorName: trimmedName,
        baby,
        encouragementId,
        event: "created",
        message: trimmedMessage,
      });
    }

    return encouragementId;
  },
});

export const update = mutationWithTriggers({
  args: {
    encouragementId: v.id("encouragements"),
    message: v.string(),
    visitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const encouragement = await ctx.db.get(args.encouragementId);
    if (!encouragement || !isActive(encouragement)) {
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

    await ctx.db.patch(args.encouragementId, {
      message: trimmedMessage,
    });

    const baby = await ctx.db.get(encouragement.babyId);
    if (baby && isActive(baby)) {
      await scheduleOwnerEncouragementPush(ctx, {
        authorName: encouragement.authorName,
        baby,
        encouragementId: args.encouragementId,
        event: "updated",
        message: trimmedMessage,
      });
    }
  },
});

export const listByBaby = query({
  args: {
    babyId: v.id("baby"),
    /** The caller's visitor id, used to mark their posts with `isMine`. */
    paginationOpts: paginationOptsValidator,
    visitorId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("encouragements")
      .withIndex("by_babyId_and_createdAt", (q) => q.eq("babyId", args.babyId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Public DTO: never return visitorId (the edit/delete credential) or the
    // userAgent/locale/timezone metadata. Soft-deleted rows are omitted.
    return {
      ...result,
      page: result.page.filter(isActive).map((encouragement) => ({
        _id: encouragement._id,
        authorName: encouragement.authorName,
        createdAt: encouragement.createdAt,
        isMine: args.visitorId != null && encouragement.visitorId === args.visitorId,
        message: encouragement.message,
      })),
    };
  },
});

export const remove = mutationWithTriggers({
  args: {
    encouragementId: v.id("encouragements"),
    visitorId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const encouragement = await ctx.db.get(args.encouragementId);
    if (!encouragement || !isActive(encouragement)) {
      throw new Error("Encouragement not found");
    }

    const baby = await ctx.db.get(encouragement.babyId);
    if (!baby || !isActive(baby)) {
      throw new Error("Baby not found");
    }

    // Check if user can manage the baby (owner or co-parent)
    const identity = await ctx.auth.getUserIdentity();
    const isManager = identity
      ? await canManageBaby(ctx, { baby, identity: appIdentity(identity) })
      : false;

    // Check if visitor can delete (matches visitorId and within time window)
    const canVisitorDelete =
      args.visitorId &&
      encouragement.visitorId === args.visitorId &&
      isWithinEditWindow(encouragement.createdAt);

    if (!isManager && !canVisitorDelete) {
      throw new Error("Not authorized to delete this encouragement");
    }

    await scheduleOwnerEncouragementDismiss(ctx, {
      baby,
      encouragementId: args.encouragementId,
    });

    await deleteEncouragementWithTimelineItem(ctx, encouragement);
  },
});
