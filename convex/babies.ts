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

    return baby;
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
    date: v.union(v.string(), v.null()),
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

    const updateData: {
      laborStarted?: string;
      wentToHospital?: string;
      babyBorn?: string;
    } = {};

    if (args.date) {
      // Marking a status - ensure previous statuses are also set
      if (args.status === "gone_to_hospital") {
        // If marking "gone to hospital", ensure "labor started" is also set
        updateData.wentToHospital = args.date;
        if (!baby.laborStarted) {
          updateData.laborStarted = args.date;
        }
      } else if (args.status === "born") {
        // If marking "born", ensure both "labor started" and "gone to hospital" are set
        updateData.babyBorn = args.date;
        if (!baby.laborStarted) {
          updateData.laborStarted = args.date;
        }
        if (!baby.wentToHospital) {
          updateData.wentToHospital = args.date;
        }
      } else {
        // "labor_started" - just set it
        updateData.laborStarted = args.date;
      }
    } else {
      // Unmarking a status - also unmark subsequent statuses
      if (args.status === "labor_started") {
        // Unmarking "labor started" also unmarks "gone to hospital" and "born"
        updateData.laborStarted = undefined;
        updateData.wentToHospital = undefined;
        updateData.babyBorn = undefined;
      } else if (args.status === "gone_to_hospital") {
        // Unmarking "gone to hospital" also unmarks "born"
        updateData.wentToHospital = undefined;
        updateData.babyBorn = undefined;
      } else {
        // Unmarking "born" - just unmark it
        updateData.babyBorn = undefined;
      }
    }

    await ctx.db.patch(args.babyId, updateData);
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

export const updateCustomMessage = mutation({
  args: {
    babyId: v.id("babies"),
    customMessage: v.union(v.string(), v.null()),
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
      customMessage: args.customMessage || undefined,
    });
  },
});
