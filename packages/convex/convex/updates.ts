import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  getBlockingLaterMilestone,
  getCurrentStatus,
  MILESTONE_FIELDS,
  MILESTONE_LABELS,
  STATUS_ORDER,
} from "../src/types";
import { applyPhotoSideEffects, syncStatusNotifications } from "./baby";
import {
  deleteUpdateWithTimelineItem,
  findMilestoneUpdate,
  insertUpdateWithTimelineItem,
} from "./timeline";
import { mutationWithTriggers } from "./triggers";
import { isActive } from "./softDelete";

const milestoneValidator = v.union(
  v.literal("labor_started"),
  v.literal("gone_to_hospital"),
  v.literal("born"),
);

export const MAX_UPDATE_MESSAGE_LENGTH = 1000;

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
    // Event clock for a milestone (ms epoch): when it actually happened.
    // Defaults to "now"; lets the owner backdate when posting after the fact.
    occurredAt: v.optional(v.union(v.number(), v.null())),
    photoId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const baby = await ctx.db.get(args.babyId);
    if (!baby || !isActive(baby)) throw new Error("Baby not found");
    if (baby.userId !== identity.subject) throw new Error("Not authorized");

    const message = args.message?.trim() || null;
    const milestone = args.milestone ?? null;
    const photoId = args.photoId ?? null;

    if (!message && !milestone && !photoId) {
      throw new Error("An update needs a message, a photo, or a milestone");
    }
    if (message && message.length > MAX_UPDATE_MESSAGE_LENGTH) {
      throw new Error(`Message must be ${MAX_UPDATE_MESSAGE_LENGTH} characters or less`);
    }

    const statusBefore = getCurrentStatus(baby);

    if (milestone) {
      // The status only moves forward: once a later stage is reached, earlier
      // (or equal) stages can no longer be marked
      if (STATUS_ORDER[milestone] <= STATUS_ORDER[statusBefore.type]) {
        throw new Error("Only a future status can be marked");
      }
      const existing = await findMilestoneUpdate(ctx, args.babyId, milestone);
      if (existing) {
        throw new Error("This milestone is already marked");
      }
    }
    if (args.occurredAt != null && !milestone) {
      throw new Error("A backdated time requires a status change");
    }

    const postedAt = Date.now();
    // Event clock: when the milestone actually happened. Defaults to the
    // announce time; a backdated value must be in the past.
    const occurredAt = milestone ? (args.occurredAt ?? postedAt) : null;
    if (occurredAt != null && occurredAt > postedAt + 60_000) {
      throw new Error("The event time cannot be in the future");
    }

    const { updateId } = await insertUpdateWithTimelineItem(ctx, {
      babyId: args.babyId,
      postedAt,
      message,
      milestone,
      // Settings can still redate occurredAt later without moving the feed position
      occurredAt,
      photoId,
    });

    if (photoId) {
      await applyPhotoSideEffects(ctx, { baby, photoId, updateId });
    }

    if (milestone) {
      // The canonical status timestamp is the event clock, not the announce time
      const dateField = MILESTONE_FIELDS[milestone].date;
      if (!baby[dateField]) {
        await ctx.db.patch(args.babyId, {
          [dateField]: new Date(occurredAt ?? postedAt).toISOString(),
        });
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
 * Owner pins a photo from the timeline as the baby's current page photo.
 * New photo uploads still take over by default (latest wins) — this lets the
 * owner bring back any earlier photo without re-uploading it.
 */
export const setAsCurrentPhoto = mutationWithTriggers({
  args: { updateId: v.id("updates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const update = await ctx.db.get(args.updateId);
    if (!update || !isActive(update)) throw new Error("Update not found");
    if (!update.photoId) throw new Error("This update has no photo");

    const baby = await ctx.db.get(update.babyId);
    if (!baby || !isActive(baby)) throw new Error("Baby not found");
    if (baby.userId !== identity.subject) throw new Error("Not authorized");

    await ctx.db.patch(baby._id, {
      photoId: update.photoId,
      thumbnailId: update.thumbnailId ?? null,
    });

    if (!update.thumbnailId) {
      await ctx.scheduler.runAfter(0, internal.babyThumbnails.generateThumbnail, {
        babyId: baby._id,
        photoId: update.photoId,
        updateId: update._id,
      });
    }
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
    if (!update || !isActive(update)) throw new Error("Update not found");

    const baby = await ctx.db.get(update.babyId);
    if (!baby || !isActive(baby)) throw new Error("Baby not found");
    if (baby.userId !== identity.subject) throw new Error("Not authorized");

    if (update.milestone) {
      const blocker = getBlockingLaterMilestone(baby, update.milestone);
      if (blocker) {
        throw new Error(`Delete the ${MILESTONE_LABELS[blocker]} status first`);
      }
    }

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
    if (candidate._id === removed._id || !candidate.photoId || !isActive(candidate)) continue;
    const timelineItem = await ctx.db.get(candidate.timelineItemId);
    if (!timelineItem || !isActive(timelineItem)) continue;
    if (!latest || timelineItem.postedAt > latest.postedAt) {
      latest = { update: candidate, postedAt: timelineItem.postedAt };
    }
  }
  return latest?.update ?? null;
}
