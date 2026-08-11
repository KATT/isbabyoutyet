import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getCurrentStatus, MILESTONE_FIELDS } from "../src/types";
import { applyPhotoSideEffects, syncStatusNotifications } from "./baby";
import {
  deleteUpdateWithTimelineItem,
  findMilestoneUpdate,
  insertUpdateWithTimelineItem,
} from "./timeline";
import { mutationWithTriggers } from "./triggers";

const milestoneValidator = v.union(
  v.literal("labor_started"),
  v.literal("gone_to_hospital"),
  v.literal("born"),
);

/**
 * Owner posts an update to the timeline: a message and/or a photo, optionally
 * marking a milestone. Marking a milestone also sets the canonical status
 * timestamp on the baby doc and schedules the push notification.
 */
export const post = mutationWithTriggers({
  args: {
    babyId: v.id("baby"),
    message: v.optional(v.union(v.string(), v.null())),
    milestone: v.optional(v.union(milestoneValidator, v.null())),
    photoId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const baby = await ctx.db.get(args.babyId);
    if (!baby) throw new Error("Baby not found");
    if (baby.userId !== identity.subject) throw new Error("Not authorized");

    const message = args.message?.trim() || null;
    const milestone = args.milestone ?? null;
    const photoId = args.photoId ?? null;

    if (!message && !milestone && !photoId) {
      throw new Error("An update needs a message, a photo, or a milestone");
    }

    if (milestone) {
      const existing = await findMilestoneUpdate(ctx, args.babyId, milestone);
      if (existing) {
        throw new Error("This milestone is already marked");
      }
    }

    const statusBefore = getCurrentStatus(baby);
    const postedAt = Date.now();

    const { updateId } = await insertUpdateWithTimelineItem(ctx, {
      babyId: args.babyId,
      postedAt,
      message,
      milestone,
      photoId,
    });

    if (photoId) {
      await applyPhotoSideEffects(ctx, { baby, photoId, updateId });
    }

    if (milestone) {
      const dateField = MILESTONE_FIELDS[milestone].date;
      if (!baby[dateField]) {
        await ctx.db.patch(args.babyId, { [dateField]: new Date(postedAt).toISOString() });
      }

      const updatedBaby = await ctx.db.get(args.babyId);
      if (!updatedBaby) throw new Error("Baby not found after update");

      await syncStatusNotifications(ctx, {
        statusBefore,
        updatedBaby,
        customMessageByMilestone: {
          labor_started: milestone === "labor_started" ? message : null,
          gone_to_hospital: milestone === "gone_to_hospital" ? message : null,
          born: milestone === "born" ? message : null,
        },
      });
    }

    return updateId;
  },
});

/**
 * Owner removes an update from the timeline. Removing a milestone update also
 * unmarks the milestone on the baby doc; removing the update carrying the
 * current photo falls back to the most recent remaining photo update.
 */
export const remove = mutationWithTriggers({
  args: { updateId: v.id("updates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const update = await ctx.db.get(args.updateId);
    if (!update) throw new Error("Update not found");

    const baby = await ctx.db.get(update.babyId);
    if (!baby) throw new Error("Baby not found");
    if (baby.userId !== identity.subject) throw new Error("Not authorized");

    const statusBefore = getCurrentStatus(baby);

    await deleteUpdateWithTimelineItem(ctx, update);

    if (update.photoId && update.photoId === baby.photoId) {
      const fallback = await findLatestRemainingPhotoUpdate(ctx, update);
      await ctx.db.patch(baby._id, {
        photoId: fallback?.photoId ?? null,
        thumbnailId: fallback?.thumbnailId ?? null,
      });
    }

    if (update.milestone) {
      const dateField = MILESTONE_FIELDS[update.milestone].date;
      if (baby[dateField]) {
        await ctx.db.patch(baby._id, { [dateField]: null });
      }

      const updatedBaby = await ctx.db.get(baby._id);
      if (!updatedBaby) throw new Error("Baby not found after update");

      // Status can only move backward here: cancels pending notifications
      await syncStatusNotifications(ctx, {
        statusBefore,
        updatedBaby,
        customMessageByMilestone: { labor_started: null, gone_to_hospital: null, born: null },
      });
    }
  },
});

async function findLatestRemainingPhotoUpdate(ctx: MutationCtx, removed: Doc<"updates">) {
  const photoUpdates = await ctx.db
    .query("updates")
    .withIndex("by_babyId", (q) => q.eq("babyId", removed.babyId))
    .collect();

  let latest: { update: Doc<"updates">; postedAt: number } | null = null;
  for (const candidate of photoUpdates) {
    if (candidate._id === removed._id || !candidate.photoId) continue;
    const timelineItem = await ctx.db.get(candidate.timelineItemId);
    if (!timelineItem) continue;
    if (!latest || timelineItem.postedAt > latest.postedAt) {
      latest = { update: candidate, postedAt: timelineItem.postedAt };
    }
  }
  return latest?.update ?? null;
}
