import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { Milestone } from "../src/types";

/**
 * The per-baby feed. `timelineItems` binds owner updates and visitor
 * encouragements into one stream ordered by `postedAt`; each child row points
 * back at its timeline row via `timelineItemId`.
 */

async function findUpdateByTimelineItem(ctx: QueryCtx, timelineItemId: Id<"timelineItems">) {
  return await ctx.db
    .query("updates")
    .withIndex("by_timelineItemId", (q) => q.eq("timelineItemId", timelineItemId))
    .unique();
}

async function findEncouragementByTimelineItem(ctx: QueryCtx, timelineItemId: Id<"timelineItems">) {
  return await ctx.db
    .query("encouragements")
    .withIndex("by_timelineItemId", (q) => q.eq("timelineItemId", timelineItemId))
    .unique();
}

async function hydrateUpdate(ctx: QueryCtx, item: Doc<"timelineItems">, update: Doc<"updates">) {
  const photoUrl = update.photoId ? await ctx.storage.getUrl(update.photoId) : null;
  const thumbnailUrl = update.thumbnailId ? await ctx.storage.getUrl(update.thumbnailId) : null;
  return {
    _id: item._id,
    kind: "update" as const,
    postedAt: item.postedAt,
    update: { ...update, photoUrl, thumbnailUrl },
  };
}

async function hydrateTimelineItem(ctx: QueryCtx, item: Doc<"timelineItems">) {
  switch (item.kind) {
    case "update": {
      const update = await findUpdateByTimelineItem(ctx, item._id);
      if (!update) return null;
      return await hydrateUpdate(ctx, item, update);
    }
    case "encouragement": {
      const encouragement = await findEncouragementByTimelineItem(ctx, item._id);
      if (!encouragement) return null;
      return {
        _id: item._id,
        kind: "encouragement" as const,
        postedAt: item.postedAt,
        encouragement,
      };
    }
  }
}

export type TimelineItem = NonNullable<Awaited<ReturnType<typeof hydrateTimelineItem>>>;

export const listByBaby = query({
  args: {
    babyId: v.id("baby"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("timelineItems")
      .withIndex("by_babyId_postedAt", (q) => q.eq("babyId", args.babyId))
      .order("desc")
      .paginate(args.paginationOpts);

    const page: TimelineItem[] = [];
    for (const item of result.page) {
      const hydrated = await hydrateTimelineItem(ctx, item);
      if (hydrated) {
        page.push(hydrated);
      }
    }

    return { ...result, page };
  },
});

/**
 * The newest owner update — powers the status card's "latest message on top".
 */
export const latestUpdate = query({
  args: { babyId: v.id("baby") },
  handler: async (ctx, args) => {
    const items = ctx.db
      .query("timelineItems")
      .withIndex("by_babyId_postedAt", (q) => q.eq("babyId", args.babyId))
      .order("desc");

    for await (const item of items) {
      if (item.kind !== "update") continue;
      const update = await findUpdateByTimelineItem(ctx, item._id);
      if (!update) continue;
      return await hydrateUpdate(ctx, item, update);
    }
    return null;
  },
});

// --- Write helpers (shared by baby.ts, updates.ts, encouragements.ts, migrations.ts) ---

/**
 * Inserts an owner update together with its timeline row.
 */
export async function insertUpdateWithTimelineItem(
  ctx: MutationCtx,
  opts: {
    babyId: Id<"baby">;
    postedAt: number;
    message?: string | null;
    milestone?: Milestone | null;
    photoId?: Id<"_storage"> | null;
    thumbnailId?: Id<"_storage"> | null;
  },
) {
  const timelineItemId = await ctx.db.insert("timelineItems", {
    babyId: opts.babyId,
    kind: "update",
    postedAt: opts.postedAt,
  });
  const updateId = await ctx.db.insert("updates", {
    babyId: opts.babyId,
    timelineItemId,
    message: opts.message ?? null,
    milestone: opts.milestone ?? null,
    photoId: opts.photoId ?? null,
    thumbnailId: opts.thumbnailId ?? null,
  });
  return { timelineItemId, updateId };
}

/**
 * Deletes an owner update and cascades to its timeline row.
 */
export async function deleteUpdateWithTimelineItem(ctx: MutationCtx, update: Doc<"updates">) {
  await ctx.db.delete(update._id);
  await ctx.db.delete(update.timelineItemId);
}

/**
 * Finds the update row marking a given milestone for a baby, if any.
 * There is at most one per milestone (enforced by the write paths).
 */
export async function findMilestoneUpdate(ctx: QueryCtx, babyId: Id<"baby">, milestone: Milestone) {
  return await ctx.db
    .query("updates")
    .withIndex("by_babyId", (q) => q.eq("babyId", babyId))
    .filter((q) => q.eq(q.field("milestone"), milestone))
    .first();
}

/**
 * Inserts the timeline row for an encouragement. The caller stores the
 * returned id on the encouragement document.
 */
export async function insertEncouragementTimelineItem(
  ctx: MutationCtx,
  opts: { babyId: Id<"baby">; postedAt: number },
) {
  return await ctx.db.insert("timelineItems", {
    babyId: opts.babyId,
    kind: "encouragement",
    postedAt: opts.postedAt,
  });
}
