import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { customAlphabet } from "nanoid";

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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

    let publicId = slugify(args.name);
    let tries = 0;

    while (
      await ctx.db
        .query("babies")
        .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
        .first()
    ) {
      tries++;
      publicId = `${slugify(args.name)}-${tries}`;
    }

    const babyId = await ctx.db.insert("babies", {
      userId: identity.subject,
      name: args.name,
      dueDate: args.dueDate,
      publicId,
      customMessage: null,
      laborStarted: null,
      wentToHospital: null,
      babyBorn: null,
      createdAt: Date.now(),
    });

    return { babyId, publicId };
  },
});

export const update = mutation({
  args: {
    babyId: v.id("babies"),
    laborStarted: v.optional(v.union(v.string(), v.null())),
    wentToHospital: v.optional(v.union(v.string(), v.null())),
    babyBorn: v.optional(v.union(v.string(), v.null())),
    dueDate: v.optional(v.string()),
    customMessage: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { babyId, ...rest } = args;
    // Verify ownership
    const baby = await ctx.db.get(babyId);
    if (!baby) {
      throw new Error("Baby not found");
    }

    if (baby.userId !== identity.subject) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(babyId, rest);
  },
});
