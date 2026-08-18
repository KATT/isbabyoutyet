import { v } from "convex/values";
import { env, internalMutation, mutation, query } from "./_generated/server";
import type { DatabaseReader, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  getBlockingLaterMilestone,
  getBirthJourney,
  getCurrentStatus,
  isStatusForward,
  isMilestoneInJourney,
  MILESTONE_FIELDS,
  MILESTONE_LABELS,
  MILESTONES,
} from "../src/types";
import type { BabyStatus, Milestone } from "../src/types";
import { DEFAULT_LOCALE, resolveSupportedLocale } from "../src/i18n";
import { supportedLocaleValidator } from "./i18n";
import { mutationWithTriggers } from "./triggers";
import {
  deleteUpdateWithTimelineItem,
  findMilestoneUpdate,
  insertUpdateWithTimelineItem,
} from "./timeline";
import { isActive, softDeletePatch } from "./softDelete";
import { requireBabyManager, requireBabyOwner } from "./babyAccess";
import { listBabiesForUser } from "./coParents";
import { isHomepageDemoPublicId } from "../src/seedCredentials";
import { appIdentity } from "./authIdentity";
import { toBabyDto } from "./babyDto";

const birthJourneyValidator = v.union(
  v.literal("labour"),
  v.literal("planned_c_section"),
  v.literal("home_birth"),
);

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    return await listBabiesForUser(ctx, appIdentity(identity));
  },
});

export const getByPublicId = query({
  args: {
    id: v.union(v.id("baby"), v.string()),
  },
  handler: async (ctx, args) => {
    // Check if it's a valid Convex ID and try to fetch directly
    const normalizedId = ctx.db.normalizeId("baby", args.id);
    let baby: Doc<"baby"> | null = null;
    if (normalizedId) {
      baby = await ctx.db.get(normalizedId);
    }

    // Fall back to publicId lookup
    if (!baby) {
      baby = await ctx.db
        .query("baby")
        .withIndex("by_publicId", (q) => q.eq("publicId", args.id))
        .first();
    }

    // If not found, check historical publicIds
    const latestHistoryEntry = await ctx.db
      .query("babyPublicIdHistory")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.id))
      .order("desc")
      .first();

    if (latestHistoryEntry) {
      baby = await ctx.db.get(latestHistoryEntry.babyId);
    }

    if (!baby || !isActive(baby)) {
      return null;
    }

    const photoUrl = baby.photoId ? await ctx.storage.getUrl(baby.photoId) : null;
    const thumbnailUrl = baby.thumbnailId ? await ctx.storage.getUrl(baby.thumbnailId) : null;
    const resolvedLocale = await resolveBabyLocale(ctx.db, baby);

    return {
      ...toBabyDto(baby),
      photoUrl,
      thumbnailUrl,
      resolvedLocale,
    };
  },
});

export type Baby = Doc<"baby">;

// Generate upload URL for baby photo
export const generateUploadUrl = mutation({
  args: { babyId: v.id("baby") },
  handler: async (ctx, args) => {
    await requireBabyManager(ctx, args.babyId);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Applies the side effects of a new photo attached to an update row: points
 * the baby doc at it (current photo), schedules thumbnail generation for both
 * the baby and the update row, and pushes a notification for the first photo.
 */
export async function applyPhotoSideEffects(
  ctx: MutationCtx,
  opts: { baby: Doc<"baby">; photoId: Id<"_storage">; updateId: Id<"updates"> },
) {
  const baby = opts.baby;
  const hadPhotoBeforeUpdate = !!baby.photoId;

  // Update the current photo (retain old photos in storage + feed for history)
  await ctx.db.patch(baby._id, { photoId: opts.photoId, thumbnailId: null });

  await ctx.scheduler.runAfter(0, internal.babyThumbnails.generateThumbnail, {
    babyId: baby._id,
    photoId: opts.photoId,
    updateId: opts.updateId,
  });

  // Send notification only if this is the first photo
  if (!hadPhotoBeforeUpdate) {
    const scheduleDelay = env.NODE_ENV === "production" ? 60_000 : 3_000;
    const scheduledFor = Date.now() + scheduleDelay;

    const notificationId = await ctx.db.insert("scheduledNotifications", {
      babyId: baby._id,
      status: "pending",
      scheduledFor,
      notificationType: "photo_added",
      customMessage: null,
      createdAt: Date.now(),
    });

    const scheduledId = await ctx.scheduler.runAt(
      scheduledFor,
      internal.pushNotifications.sendNotification,
      {
        notificationId,
        babyId: baby._id,
        babyName: baby.name,
        publicId: baby.publicId,
        status: "photo_added",
        customMessage: null,
        locale: await resolveBabyLocale(ctx.db, baby),
        birthJourney: getBirthJourney(baby),
      },
    );

    await ctx.db.patch(notificationId, { scheduledId });
  }
}

// Update baby photo and optionally send notification
export const updatePhoto = mutationWithTriggers({
  args: {
    babyId: v.id("baby"),
    photoId: v.union(v.id("_storage"), v.null()),
  },
  handler: async (ctx, args) => {
    const { identity, baby } = await requireBabyManager(ctx, args.babyId);

    if (!args.photoId) {
      // Removing the current photo only affects the baby doc; photo updates
      // already posted to the timeline keep their own copies.
      await ctx.db.patch(args.babyId, { photoId: null, thumbnailId: null });
      return;
    }

    const { updateId } = await insertUpdateWithTimelineItem(ctx, {
      babyId: args.babyId,
      postedAt: Date.now(),
      photoId: args.photoId,
      postedByUserId: identity.authUserId,
    });

    await applyPhotoSideEffects(ctx, { baby, photoId: args.photoId, updateId });
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

async function isPublicIdTaken(opts: {
  db: DatabaseReader;
  publicId: string;
  excludeTokenIdentifier: string;
}): Promise<boolean> {
  // Reserved for the seeded homepage live demos — never let a real user claim them.
  if (isHomepageDemoPublicId(opts.publicId)) {
    return true;
  }

  // Check current baby publicIds
  const existingBaby = await opts.db
    .query("baby")
    .withIndex("by_publicId", (q) => q.eq("publicId", opts.publicId))
    .first();

  if (existingBaby) {
    return true;
  }

  // Check historical publicIds (but allow the same owner to reclaim their own)
  const historicEntry = await opts.db
    .query("babyPublicIdHistory")
    .withIndex("by_publicId", (q) => q.eq("publicId", opts.publicId))
    .first();

  if (!historicEntry) {
    return false;
  }

  const historicBaby = await opts.db.get(historicEntry.babyId);
  if (historicBaby && historicBaby.ownerTokenIdentifier !== opts.excludeTokenIdentifier) {
    return true;
  }

  return false;
}

async function generateUniquePublicId(opts: {
  db: DatabaseReader;
  baseName: string;
  excludeTokenIdentifier: string;
}): Promise<string> {
  const slug = slugify(opts.baseName);
  let tries = 0;
  let publicId = slug;

  while (
    await isPublicIdTaken({
      db: opts.db,
      publicId,
      excludeTokenIdentifier: opts.excludeTokenIdentifier,
    })
  ) {
    tries++;
    publicId = `${slug}-${tries}`;
  }

  return publicId;
}

async function resolveBabyLocale(db: DatabaseReader, baby: Doc<"baby">) {
  if (baby.locale) {
    return resolveSupportedLocale(baby.locale);
  }
  const profile = await db
    .query("userProfiles")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", baby.ownerTokenIdentifier))
    .unique();
  return profile ? resolveSupportedLocale(profile.locale) : DEFAULT_LOCALE;
}

export const create = mutationWithTriggers({
  args: {
    name: v.string(),
    dueDate: v.string(),
    // Optional for stale-client compatibility; new clients always send it.
    birthJourney: v.optional(birthJourneyValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const caller = appIdentity(identity);

    const publicId = await generateUniquePublicId({
      db: ctx.db,
      baseName: args.name,
      excludeTokenIdentifier: caller.tokenIdentifier,
    });

    const babyId = await ctx.db.insert("baby", {
      userId: caller.authUserId,
      ownerTokenIdentifier: caller.tokenIdentifier,
      name: args.name,
      dueDate: args.dueDate,
      publicId,
      birthJourney: args.birthJourney ?? "labour",
      hospitalMessage: null,
      babyBornMessage: null,
      laborStartedMessage: null,
      laborStarted: null,
      wentToHospital: null,
      babyBorn: null,
      subscriptionCount: 0,
      lastActivityAt: Date.now(),
    });

    return { babyId, publicId };
  },
});

/**
 * Soft-deletes a baby page. Only the owner (creator) can do this.
 * Pending push notifications are cancelled; feed rows stay recoverable.
 */
export const remove = mutationWithTriggers({
  args: { babyId: v.id("baby") },
  handler: async (ctx, args) => {
    await requireBabyOwner(ctx, args.babyId);

    const pendingNotifications = await ctx.db
      .query("scheduledNotifications")
      .withIndex("by_babyId_and_status", (q) => q.eq("babyId", args.babyId).eq("status", "pending"))
      .take(100);

    for (const notification of pendingNotifications) {
      if (notification.scheduledId) {
        try {
          await ctx.scheduler.cancel(notification.scheduledId);
        } catch (_error) {
          // Already sent or missing — still mark cancelled below
        }
      }
      await ctx.db.patch(notification._id, { status: "cancelled" });
    }

    await ctx.db.patch(args.babyId, softDeletePatch());
  },
});

export const getScheduledNotifications = query({
  args: { babyId: v.id("baby") },
  handler: async (ctx, args) => {
    await requireBabyManager(ctx, args.babyId);

    const notifications = await ctx.db
      .query("scheduledNotifications")
      .withIndex("by_babyId", (q) => q.eq("babyId", args.babyId))
      .order("desc")
      .take(100);

    return notifications;
  },
});

export const cancelScheduledNotification = mutation({
  args: { notificationId: v.id("scheduledNotifications") },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    await requireBabyManager(ctx, notification.babyId);

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

// Internal mutation to update thumbnail ID (called from action)
export const updateThumbnail = internalMutation({
  args: {
    babyId: v.id("baby"),
    thumbnailId: v.id("_storage"),
    photoId: v.optional(v.id("_storage")), // photo the thumbnail was generated from
    updateId: v.optional(v.id("updates")), // timeline update row to also patch
  },
  handler: async (ctx, args) => {
    const baby = await ctx.db.get(args.babyId);
    // Skip the baby doc if its current photo changed while the thumbnail was
    // generating — a newer generation owns the field now.
    if (baby && (!args.photoId || baby.photoId === args.photoId)) {
      await ctx.db.patch(args.babyId, { thumbnailId: args.thumbnailId });
    }

    if (args.updateId) {
      const update = await ctx.db.get(args.updateId);
      if (update && (!args.photoId || update.photoId === args.photoId)) {
        await ctx.db.patch(args.updateId, { thumbnailId: args.thumbnailId });
      }
    }
  },
});

/**
 * Cancels pending push notifications and schedules a new one when the derived
 * status moved forward. No-op when the status type is unchanged.
 */
export async function syncStatusNotifications(
  ctx: MutationCtx,
  opts: {
    statusBefore: BabyStatus;
    updatedBaby: Doc<"baby">;
    /** Message to attach to the push, per notifiable milestone. */
    customMessageByMilestone: Record<Milestone, string | null>;
    notifyForward: boolean;
  },
) {
  const updatedBaby = opts.updatedBaby;
  const statusAfter = getCurrentStatus(updatedBaby);

  if (opts.statusBefore.type === statusAfter.type) {
    // no notification change as status didn't change
    return;
  }

  // Cancel any existing pending notifications
  const pendingNotifications = await ctx.db
    .query("scheduledNotifications")
    .withIndex("by_babyId_and_status", (q) =>
      q.eq("babyId", updatedBaby._id).eq("status", "pending"),
    )
    .take(100);

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
  if (!opts.notifyForward || !isStatusForward(opts.statusBefore, statusAfter)) return;

  const customMessage = opts.customMessageByMilestone[statusAfter.type];

  const scheduleDelay = env.NODE_ENV === "production" ? 60_000 : 3_000;
  const scheduledFor = Date.now() + scheduleDelay;

  const notificationId = await ctx.db.insert("scheduledNotifications", {
    babyId: updatedBaby._id,
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
      babyId: updatedBaby._id,
      babyName: updatedBaby.name,
      publicId: updatedBaby.publicId,
      status: statusAfter.type,
      customMessage,
      locale: await resolveBabyLocale(ctx.db, updatedBaby),
      birthJourney: getBirthJourney(updatedBaby),
    },
  );

  await ctx.db.patch(notificationId, { scheduledId });
}

/**
 * Keeps the timeline's milestone update rows in sync with the canonical
 * status fields on the baby doc:
 * - marking a milestone creates its update row (postedAt = now, occurredAt = event)
 * - redating a milestone updates `occurredAt` only — feed position stays put
 * - unmarking a milestone deletes its update + timeline rows
 * - a legacy stage-message arg (stale-client compat) lands on the row's message
 */
async function syncMilestoneUpdates(
  ctx: MutationCtx,
  opts: {
    baby: Doc<"baby">;
    patch: {
      laborStarted?: string | null;
      wentToHospital?: string | null;
      babyBorn?: string | null;
    };
    legacyMessages: Partial<Record<Milestone, string | null>>;
    postedByUserId: string;
  },
) {
  const baby = opts.baby;
  for (const milestone of MILESTONES) {
    const fields = MILESTONE_FIELDS[milestone];
    const dateArg = opts.patch[fields.date];
    const messageArg = opts.legacyMessages[milestone];
    if (dateArg === undefined && messageArg === undefined) continue;
    const existing = await findMilestoneUpdate(ctx, { babyId: baby._id, milestone: milestone });

    if (dateArg === null) {
      // Unmarked: the milestone leaves the feed
      if (existing) {
        await deleteUpdateWithTimelineItem(ctx, existing);
      }
      continue;
    }

    if (typeof dateArg === "string") {
      // Validated parseable by the update handler
      const occurredAt = Date.parse(dateArg);
      if (existing) {
        // Redate: update the event clock only — do not reshuffle the feed
        await ctx.db.patch(existing._id, {
          occurredAt,
          ...(messageArg !== undefined ? { message: messageArg } : {}),
        });
      } else {
        await insertUpdateWithTimelineItem(ctx, {
          babyId: baby._id,
          // Announced now (settings mark), even if the event clock is historical
          postedAt: Date.now(),
          occurredAt,
          milestone,
          message: messageArg ?? null,
          postedByUserId: opts.postedByUserId,
        });
      }
      continue;
    }

    // Date untouched: a stale client edited just the stage message
    if (messageArg !== undefined && existing) {
      await ctx.db.patch(existing._id, { message: messageArg });
    }
  }
}

export const update = mutationWithTriggers({
  args: {
    babyId: v.id("baby"),
    laborStarted: v.optional(v.union(v.string(), v.null())),
    wentToHospital: v.optional(v.union(v.string(), v.null())),
    babyBorn: v.optional(v.union(v.string(), v.null())),
    dueDate: v.optional(v.string()),
    name: v.optional(v.string()),
    theme: v.optional(v.union(v.string(), v.null())),
    locale: v.optional(v.union(supportedLocaleValidator, v.null())),
    birthJourney: v.optional(birthJourneyValidator),
    encouragementsDisabled: v.optional(v.boolean()),
    // DEPRECATED stale-client compat (the pre-cleanup UI still sends these
    // during the deploy window): mapped onto the milestone update rows, never
    // written to the baby doc. Remove in a later tidy-up once stale tabs are
    // realistically gone.
    laborStartedMessage: v.optional(v.union(v.string(), v.null())),
    hospitalMessage: v.optional(v.union(v.string(), v.null())),
    babyBornMessage: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { babyId, laborStartedMessage, hospitalMessage, babyBornMessage, ...rest } = args;
    const { identity, baby } = await requireBabyManager(ctx, babyId);
    const legacyMessages = {
      labor_started: laborStartedMessage,
      gone_to_hospital: hospitalMessage,
      born: babyBornMessage,
    };
    const nextBirthJourney = rest.birthJourney ?? getBirthJourney(baby);
    const birthJourneyChanged =
      rest.birthJourney !== undefined && rest.birthJourney !== getBirthJourney(baby);

    if (birthJourneyChanged && (baby.wentToHospital || baby.babyBorn)) {
      throw new Error("The birth plan cannot be changed after the hospital milestone");
    }
    for (const milestone of MILESTONES) {
      if (
        typeof rest[MILESTONE_FIELDS[milestone].date] === "string" &&
        !isMilestoneInJourney({ birthJourney: nextBirthJourney }, milestone)
      ) {
        throw new Error("That milestone is not part of the selected birth journey");
      }
    }

    // Milestone dates are event clocks: they must parse and cannot be in the
    // future (mirrors the `updates.post` occurredAt guard, so settings
    // redating can't bypass it)
    for (const milestone of MILESTONES) {
      const dateArg = rest[MILESTONE_FIELDS[milestone].date];
      if (typeof dateArg !== "string") continue;
      const parsed = Date.parse(dateArg);
      if (Number.isNaN(parsed)) {
        throw new Error("Invalid date");
      }
      if (parsed > Date.now() + 60_000) {
        throw new Error("The event time cannot be in the future");
      }
    }

    for (const milestone of MILESTONES) {
      if (rest[MILESTONE_FIELDS[milestone].date] !== null) continue;
      const blocker = getBlockingLaterMilestone(baby, milestone);
      if (blocker) {
        throw new Error(`Delete the ${MILESTONE_LABELS[blocker]} status first`);
      }
    }

    const statusBefore = getCurrentStatus(baby);

    const patch: Partial<typeof baby> = rest;
    // If name changed and the slugified name would result in a different publicId
    if (patch.name && patch.name !== baby.name) {
      const newSlugifiedName = slugify(patch.name);
      // Only update publicId if the slugified name is different from current publicId
      if (newSlugifiedName !== baby.publicId) {
        const oldPublicId = baby.publicId;
        patch.publicId = await generateUniquePublicId({
          db: ctx.db,
          baseName: patch.name,
          excludeTokenIdentifier: identity.tokenIdentifier,
        });
        await ctx.db.insert("babyPublicIdHistory", { babyId, publicId: oldPublicId });
      }
    }

    await ctx.db.patch(babyId, patch);

    await syncMilestoneUpdates(ctx, {
      baby,
      patch: rest,
      legacyMessages,
      postedByUserId: identity.authUserId,
    });

    const updatedBaby = await ctx.db.get(babyId);
    if (!updatedBaby) throw new Error("Baby not found after update");

    // Settings status changes don't carry a message (attach one by posting an
    // update); a stale client's legacy message arg still rides along
    await syncStatusNotifications(ctx, {
      statusBefore,
      updatedBaby,
      // Switching journeys can reveal or hide a preserved labour milestone.
      // That is a presentation change, not a new event to announce.
      notifyForward:
        !birthJourneyChanged ||
        MILESTONES.some((milestone) => rest[MILESTONE_FIELDS[milestone].date] !== undefined),
      customMessageByMilestone: {
        labor_started: legacyMessages.labor_started ?? null,
        gone_to_hospital: legacyMessages.gone_to_hospital ?? null,
        born: legacyMessages.born ?? null,
      },
    });
  },
});
