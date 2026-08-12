import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { Milestone } from "../src/types";
import { isActive, softDeletePatch } from "./softDelete";

/**
 * The per-baby feed. `timelineItems` binds owner updates and visitor
 * encouragements into one stream ordered by `postedAt`; each child row points
 * back at its timeline row via `timelineItemId`.
 */

async function findUpdateByTimelineItem(ctx: QueryCtx, timelineItemId: Id<"timelineItems">) {
  // .first() (not .unique()): a duplicate child row would be a data bug, but
  // it must not take the whole public feed down.
  return await ctx.db
    .query("updates")
    .withIndex("by_timelineItemId", (q) => q.eq("timelineItemId", timelineItemId))
    .first();
}

async function findEncouragementByTimelineItem(ctx: QueryCtx, timelineItemId: Id<"timelineItems">) {
  return await ctx.db
    .query("encouragements")
    .withIndex("by_timelineItemId", (q) => q.eq("timelineItemId", timelineItemId))
    .first();
}

async function hydrateUpdate(
  ctx: QueryCtx,
  item: Doc<"timelineItems">,
  update: Doc<"updates">,
  currentPhotoId: Id<"_storage"> | null,
) {
  const photoUrl = update.photoId ? await ctx.storage.getUrl(update.photoId) : null;
  const thumbnailUrl = update.thumbnailId ? await ctx.storage.getUrl(update.thumbnailId) : null;
  return {
    _id: item._id,
    kind: "update" as const,
    postedAt: item.postedAt,
    update: {
      _id: update._id,
      message: update.message ?? null,
      milestone: update.milestone ?? null,
      occurredAt: update.occurredAt ?? null,
      photoUrl,
      thumbnailUrl,
      // Whether this update's photo is the baby's current page photo
      isCurrentPagePhoto: !!update.photoId && update.photoId === currentPhotoId,
    },
  };
}

/**
 * Public shape of an encouragement in the feed. Deliberately excludes
 * `visitorId` (it is the edit/delete credential) and the `userAgent` /
 * `locale` / `timezone` metadata. `isMine` is computed from the
 * caller-supplied visitorId so the client can offer edit/delete.
 */
function toPublicEncouragement(encouragement: Doc<"encouragements">, visitorId?: string) {
  return {
    _id: encouragement._id,
    authorName: encouragement.authorName,
    message: encouragement.message,
    createdAt: encouragement.createdAt,
    isMine: visitorId !== undefined && encouragement.visitorId === visitorId,
  };
}

async function hydrateTimelineItem(
  ctx: QueryCtx,
  item: Doc<"timelineItems">,
  opts: { visitorId?: string; currentPhotoId: Id<"_storage"> | null },
) {
  if (!isActive(item)) return null;

  switch (item.kind) {
    case "update": {
      const update = await findUpdateByTimelineItem(ctx, item._id);
      if (!update || !isActive(update)) return null;
      return await hydrateUpdate(ctx, item, update, opts.currentPhotoId);
    }
    case "encouragement": {
      const encouragement = await findEncouragementByTimelineItem(ctx, item._id);
      if (!encouragement || !isActive(encouragement)) return null;
      return {
        _id: item._id,
        kind: "encouragement" as const,
        postedAt: item.postedAt,
        encouragement: toPublicEncouragement(encouragement, opts.visitorId),
      };
    }
  }
}

export type TimelineItem = NonNullable<Awaited<ReturnType<typeof hydrateTimelineItem>>>;

export const listByBaby = query({
  args: {
    babyId: v.id("baby"),
    // The caller's own visitor id, only used to mark their posts with `isMine`
    visitorId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const baby = await ctx.db.get(args.babyId);
    if (!baby || !isActive(baby)) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const currentPhotoId = baby.photoId ?? null;

    const result = await ctx.db
      .query("timelineItems")
      .withIndex("by_babyId_postedAt", (q) => q.eq("babyId", args.babyId))
      .order("desc")
      .paginate(args.paginationOpts);

    const page: TimelineItem[] = [];
    for (const item of result.page) {
      const hydrated = await hydrateTimelineItem(ctx, item, {
        visitorId: args.visitorId,
        currentPhotoId,
      });
      if (hydrated) {
        page.push(hydrated);
      }
    }

    return { ...result, page };
  },
});

/**
 * The newest owner update carrying a message — powers the status card's
 * "latest message on top". Message-less (e.g. photo-only) updates are
 * skipped so they don't blank the box while an older message exists.
 *
 * Bounded by the number of owner updates (only the owner creates them), so
 * visitor activity cannot grow this query.
 */
export const latestUpdate = query({
  args: { babyId: v.id("baby") },
  handler: async (ctx, args) => {
    const updates = await ctx.db
      .query("updates")
      .withIndex("by_babyId", (q) => q.eq("babyId", args.babyId))
      .collect();

    let latest: { update: Doc<"updates">; item: Doc<"timelineItems"> } | null = null;
    for (const update of updates) {
      if (!isActive(update) || !update.message) continue;
      const item = await ctx.db.get(update.timelineItemId);
      if (!item || !isActive(item)) continue;
      if (!latest || item.postedAt > latest.item.postedAt) {
        latest = { update, item };
      }
    }

    if (!latest) return null;
    const baby = await ctx.db.get(args.babyId);
    return await hydrateUpdate(ctx, latest.item, latest.update, baby?.photoId ?? null);
  },
});

// --- Write helpers (shared by baby.ts, updates.ts, encouragements.ts, migrations.ts) ---

/**
 * Inserts an owner update together with its timeline row.
 * `postedAt` is the feed sort key (when announced). `occurredAt` is the
 * milestone's real event time for display — omit for non-milestone updates.
 */
export async function insertUpdateWithTimelineItem(
  ctx: MutationCtx,
  opts: {
    babyId: Id<"baby">;
    postedAt: number;
    message?: string | null;
    milestone?: Milestone | null;
    occurredAt?: number | null;
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
    occurredAt: opts.occurredAt ?? null,
    photoId: opts.photoId ?? null,
    thumbnailId: opts.thumbnailId ?? null,
  });
  return { timelineItemId, updateId };
}

/**
 * Soft-deletes an owner update and its timeline row (recoverable later).
 */
export async function deleteUpdateWithTimelineItem(ctx: MutationCtx, update: Doc<"updates">) {
  const patch = softDeletePatch();
  await ctx.db.patch(update._id, patch);
  await ctx.db.patch(update.timelineItemId, patch);
}

/**
 * Soft-deletes an encouragement and its timeline row when present.
 */
export async function deleteEncouragementWithTimelineItem(
  ctx: MutationCtx,
  encouragement: Doc<"encouragements">,
) {
  const patch = softDeletePatch();
  await ctx.db.patch(encouragement._id, patch);
  if (encouragement.timelineItemId) {
    await ctx.db.patch(encouragement.timelineItemId, patch);
  }
}

/**
 * Finds the active update row marking a given milestone for a baby, if any.
 * Soft-deleted rows are ignored so a milestone can be re-marked after unmark.
 * There is at most one active row per milestone (enforced by the write paths).
 */
export async function findMilestoneUpdate(ctx: QueryCtx, babyId: Id<"baby">, milestone: Milestone) {
  const updates = await ctx.db
    .query("updates")
    .withIndex("by_babyId_milestone", (q) => q.eq("babyId", babyId).eq("milestone", milestone))
    .collect();
  return updates.find(isActive) ?? null;
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
