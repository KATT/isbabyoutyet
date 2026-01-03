import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { nanoid } from "nanoid";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const babies = await ctx.db
      .query("babies")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    return babies;
  },
});

export const getByPublicId = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const baby = await ctx.db
      .query("babies")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .first();

    if (!baby) {
      return null;
    }

    // Get all status updates for this baby
    const statusUpdates = await ctx.db
      .query("statusUpdates")
      .withIndex("by_baby", (q) => q.eq("babyId", baby._id))
      .order("desc")
      .collect();

    return {
      ...baby,
      statusUpdates,
    };
  },
});

export const getStatusUpdates = query({
  args: { babyId: v.id("babies") },
  handler: async (ctx, args) => {
    const statusUpdates = await ctx.db
      .query("statusUpdates")
      .withIndex("by_baby", (q) => q.eq("babyId", args.babyId))
      .order("desc")
      .collect();

    return statusUpdates;
  },
});

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

    const publicId = nanoid();

    const babyId = await ctx.db.insert("babies", {
      userId: identity.subject,
      name: args.name,
      dueDate: args.dueDate,
      publicId,
      createdAt: Date.now(),
    });

    return { babyId, publicId };
  },
});

export const updateStatus = mutation({
  args: {
    babyId: v.id("babies"),
    status: v.union(v.literal("labor_started"), v.literal("gone_to_hospital"), v.literal("born")),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify ownership
    const baby = await ctx.db.get(args.babyId);
    if (!baby) {
      throw new Error("Baby not found");
    }

    if (baby.userId !== identity.subject) {
      throw new Error("Not authorized");
    }

    // Check if status update already exists
    const existing = await ctx.db
      .query("statusUpdates")
      .withIndex("by_baby_status", (q) => q.eq("babyId", args.babyId).eq("status", args.status))
      .first();

    if (existing) {
      // Update existing status update
      await ctx.db.patch(existing._id, {
        date: args.date,
        createdAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new status update
      const statusUpdateId = await ctx.db.insert("statusUpdates", {
        babyId: args.babyId,
        status: args.status,
        date: args.date,
        createdAt: Date.now(),
      });
      return statusUpdateId;
    }
  },
});

export const updateDueDate = mutation({
  args: {
    babyId: v.id("babies"),
    dueDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify ownership
    const baby = await ctx.db.get(args.babyId);
    if (!baby) {
      throw new Error("Baby not found");
    }

    if (baby.userId !== identity.subject) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.babyId, {
      dueDate: args.dueDate,
    });
  },
});
