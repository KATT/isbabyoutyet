import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { DatabaseReader } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getCurrentStatus, isStatusForward } from "../src/types";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const babies = await ctx.db
      .query("baby")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    return babies;
  },
});

export const getByPublicId = query({
  args: {
    id: v.union(v.id("baby"), v.string()),
  },
  handler: async (ctx, args) => {
    // Check if it's a valid Convex ID and try to fetch directly
    const normalizedId = ctx.db.normalizeId("baby", args.id);
    if (normalizedId) {
      const byId = await ctx.db.get(normalizedId);
      if (byId) {
        return byId;
      }
    }

    // Fall back to publicId lookup
    const baby = await ctx.db
      .query("baby")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.id))
      .first();

    if (baby) {
      return baby;
    }

    // If not found, check historical publicIds
    const latestHistoryEntry = await ctx.db
      .query("babyPublicIdHistory")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.id))
      .order("desc")
      .first();

    if (!latestHistoryEntry) {
      return null;
    }

    return await ctx.db.get(latestHistoryEntry.babyId);
  },
});

export type Baby = Doc<"baby">;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function generateUniquePublicId(db: DatabaseReader, baseName: string): Promise<string> {
  let publicId = slugify(baseName);
  let tries = 0;

  while (
    await db
      .query("baby")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .first()
  ) {
    tries++;
    publicId = `${slugify(baseName)}-${tries}`;
  }

  return publicId;
}

export const create = mutation({
  args: {
    name: v.string(),
    dueDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const publicId = await generateUniquePublicId(ctx.db, args.name);

    const babyId = await ctx.db.insert("baby", {
      userId: identity.subject,
      name: args.name,
      dueDate: args.dueDate,
      publicId,
      hospitalMessage: null,
      babyBornMessage: null,
      laborStartedMessage: null,
      laborStarted: null,
      wentToHospital: null,
      babyBorn: null,
    });

    return { babyId, publicId };
  },
});

export const getScheduledNotifications = query({
  args: { babyId: v.id("baby") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const baby = await ctx.db.get(args.babyId);
    if (!baby) {
      throw new Error("Baby not found");
    }

    if (baby.userId !== identity.subject) {
      throw new Error("Not authorized");
    }

    const notifications = await ctx.db
      .query("scheduledNotifications")
      .withIndex("by_babyId", (q) => q.eq("babyId", args.babyId))
      .order("desc")
      .collect();

    return notifications;
  },
});

export const cancelScheduledNotification = mutation({
  args: { notificationId: v.id("scheduledNotifications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    const baby = await ctx.db.get(notification.babyId);
    if (!baby) {
      throw new Error("Baby not found");
    }

    if (baby.userId !== identity.subject) {
      throw new Error("Not authorized");
    }

    if (notification.status !== "pending") {
      throw new Error("Notification is not pending");
    }

    if (notification.scheduledId) {
      try {
        await ctx.scheduler.cancel(notification.scheduledId);
      } catch (error) {
        throw new Error("Failed to cancel scheduled notification: " + (error as Error).message);
      }
    }

    await ctx.db.patch(args.notificationId, { status: "cancelled" });
  },
});

export const markNotificationSent = internalMutation({
  args: { notificationId: v.id("scheduledNotifications") },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      return; // Notification already deleted or doesn't exist
    }

    if (notification.status === "pending") {
      await ctx.db.patch(args.notificationId, { status: "sent" });
    }
  },
});

export const update = mutation({
  args: {
    babyId: v.id("baby"),
    laborStarted: v.optional(v.union(v.string(), v.null())),
    wentToHospital: v.optional(v.union(v.string(), v.null())),
    babyBorn: v.optional(v.union(v.string(), v.null())),
    dueDate: v.optional(v.string()),
    hospitalMessage: v.optional(v.union(v.string(), v.null())),
    babyBornMessage: v.optional(v.union(v.string(), v.null())),
    laborStartedMessage: v.optional(v.union(v.string(), v.null())),
    name: v.optional(v.string()),
    theme: v.optional(v.union(v.string(), v.null())),
    encouragementsDisabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const { babyId, ...rest } = args;

    const baby = await ctx.db.get(babyId);
    if (!baby) throw new Error("Baby not found");
    if (baby.userId !== identity.subject) throw new Error("Not authorized");

    const statusBefore = getCurrentStatus(baby);

    const patch: Partial<typeof baby> = rest;
    // If name changed and the slugified name would result in a different publicId
    if (patch.name && patch.name !== baby.name) {
      const newSlugifiedName = slugify(patch.name);
      // Only update publicId if the slugified name is different from current publicId
      if (newSlugifiedName !== baby.publicId) {
        const oldPublicId = baby.publicId;
        patch.publicId = await generateUniquePublicId(ctx.db, patch.name);
        await ctx.db.insert("babyPublicIdHistory", { babyId, publicId: oldPublicId });
      }
    }

    await ctx.db.patch(babyId, patch);

    const updatedBaby = await ctx.db.get(babyId);
    if (!updatedBaby) throw new Error("Baby not found after update");

    const statusAfter = getCurrentStatus(updatedBaby);

    if (statusBefore === statusAfter) {
      // no notification change as status didn't change
      return;
    }

    // Cancel any existing pending notifications
    const pendingNotifications = await ctx.db
      .query("scheduledNotifications")
      .withIndex("by_babyId", (q) => q.eq("babyId", babyId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    for (const notification of pendingNotifications) {
      if (notification.scheduledId) {
        try {
          await ctx.scheduler.cancel(notification.scheduledId);
        } catch (_error) {
          // Ignore errors if notification was already sent or doesn't exist
        }
      }
      await ctx.db.patch(notification._id, { status: "cancelled" });
    }

    // Only handle notifications if status moved forward
    if (!isStatusForward(statusBefore, statusAfter)) return;

    // Schedule new notification
    let customMessage: string | null = null;
    if (statusAfter.type === "born") {
      customMessage = patch.babyBornMessage ?? baby.babyBornMessage ?? null;
    } else if (statusAfter.type === "gone_to_hospital") {
      customMessage = patch.hospitalMessage ?? baby.hospitalMessage ?? null;
    } else if (statusAfter.type === "labor_started") {
      customMessage = patch.laborStartedMessage ?? baby.laborStartedMessage ?? null;
    }

    const scheduleDelay = process.env.NODE_ENV === "production" ? 60_000 : 3_000;
    const scheduledFor = Date.now() + scheduleDelay;

    const notificationId = await ctx.db.insert("scheduledNotifications", {
      babyId,
      status: "pending",
      scheduledFor,
      notificationType: statusAfter.type,
      customMessage,
      createdAt: Date.now(),
    });

    const scheduledId = await ctx.scheduler.runAt(
      scheduledFor,
      internal.pushNotifications.sendNotification,
      {
        notificationId,
        babyId,
        babyName: updatedBaby.name,
        publicId: updatedBaby.publicId,
        status: statusAfter.type,
        customMessage,
      },
    );

    await ctx.db.patch(notificationId, { scheduledId });
  },
});
