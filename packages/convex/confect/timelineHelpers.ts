import type { MutationCtx, QueryCtx } from "../convex/_generated/server";
import type { Doc, Id } from "../convex/_generated/dataModel";
import type { Milestone } from "../src/types";

/**
 * The per-baby feed. `timelineItems` binds owner updates and visitor
 * encouragements into one stream ordered by `postedAt`; each child row points
 * back at its timeline row via `timelineItemId`.
 *
 * Write helpers shared by baby.ts, updates.ts, encouragements.ts, migrations.ts.
 */

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
