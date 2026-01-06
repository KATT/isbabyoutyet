import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { DatabaseReader } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

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
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    // First check current publicIds
    const baby = await ctx.db
      .query("baby")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .first();

    if (baby) {
      return baby;
    }

    // If not found, check historical publicIds
    // Get the most recent historical entry with this publicId (last known publicId wins)
    const latestHistoryEntry = await ctx.db
      .query("babyPublicIdHistory")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .order("desc")
      .first();

    if (!latestHistoryEntry) {
      return null;
    }

    const babyFromHistory = await ctx.db.get(latestHistoryEntry.babyId);

    return babyFromHistory;
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
      laborStarted: null,
      wentToHospital: null,
      babyBorn: null,
    });

    return { babyId, publicId };
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
    name: v.optional(v.string()),
    theme: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { babyId, ...rest } = args;

    const baby = await ctx.db.get(babyId);
    if (!baby) {
      throw new Error("Baby not found");
    }

    if (baby.userId !== identity.subject) {
      throw new Error("Not authorized");
    }

    const patch: Partial<typeof baby> = rest;
    // If name changed and the slugified name would result in a different publicId
    if (patch.name && patch.name !== baby.name) {
      const newSlugifiedName = slugify(patch.name);
      // Only update publicId if the slugified name is different from current publicId
      if (newSlugifiedName !== baby.publicId) {
        // Save the old publicId to history before updating
        const oldPublicId = baby.publicId;
        const newPublicId = await generateUniquePublicId(ctx.db, patch.name);
        patch.publicId = newPublicId;

        // Store the old publicId in history
        await ctx.db.insert("babyPublicIdHistory", {
          babyId,
          publicId: oldPublicId,
        });
      }
    }

    await ctx.db.patch(babyId, patch);
  },
});
