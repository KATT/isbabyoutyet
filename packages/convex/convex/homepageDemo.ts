import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { HOMEPAGE_DEMO_BABY } from "../src/seedCredentials";
import { HOMEPAGE_DEMO_DUE_DATE_MINUTES_AGO, HOMEPAGE_DEMO_FEED } from "../src/homepageDemoFeed";
import { insertEncouragementTimelineItem, insertUpdateWithTimelineItem } from "./timeline";
import type { Milestone } from "../src/types";

const CLEAR_BATCH_SIZE = 32;

const photoIdsValidator = v.object({
  photoId: v.id("_storage"),
  thumbnailId: v.optional(v.union(v.id("_storage"), v.null())),
});

const photosValidator = v.record(v.string(), photoIdsValidator);

type DemoPhotos = Record<string, { photoId: Id<"_storage">; thumbnailId?: Id<"_storage"> | null }>;

function dueDateIso(now: number) {
  return new Date(now - HOMEPAGE_DEMO_DUE_DATE_MINUTES_AGO * 60_000).toISOString();
}

function storageIdsToKeep(photos: DemoPhotos) {
  const keepStorageIds = new Set<string>();
  for (const photo of Object.values(photos)) {
    keepStorageIds.add(photo.photoId);
    if (photo.thumbnailId) keepStorageIds.add(photo.thumbnailId);
  }
  return keepStorageIds;
}

async function findBabyByPublicId(ctx: MutationCtx) {
  return await ctx.db
    .query("baby")
    .withIndex("by_publicId", (q) => q.eq("publicId", HOMEPAGE_DEMO_BABY.publicId))
    .unique();
}

async function ensureBabyDoc(ctx: MutationCtx, now: number) {
  const existing = await findBabyByPublicId(ctx);
  if (existing) {
    await ctx.db.patch(existing._id, {
      userId: HOMEPAGE_DEMO_BABY.ownerUserId,
      name: HOMEPAGE_DEMO_BABY.name,
      theme: HOMEPAGE_DEMO_BABY.theme,
      encouragementsDisabled: false,
      dueDate: dueDateIso(now),
    });
    return existing._id;
  }

  return await ctx.db.insert("baby", {
    userId: HOMEPAGE_DEMO_BABY.ownerUserId,
    name: HOMEPAGE_DEMO_BABY.name,
    dueDate: dueDateIso(now),
    publicId: HOMEPAGE_DEMO_BABY.publicId,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    theme: HOMEPAGE_DEMO_BABY.theme,
    encouragementsDisabled: false,
    photoId: null,
    thumbnailId: null,
  });
}

async function deleteStorageIfExists(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | null | undefined,
  keepStorageIds: Set<string>,
) {
  if (!storageId) return;
  if (keepStorageIds.has(storageId)) return;
  const meta = await ctx.db.system.get(storageId);
  if (!meta) return;
  await ctx.storage.delete(storageId);
}

async function deleteTimelineItem(
  ctx: MutationCtx,
  item: Doc<"timelineItems">,
  keepStorageIds: Set<string>,
) {
  switch (item.kind) {
    case "update": {
      const update = await ctx.db
        .query("updates")
        .withIndex("by_timelineItemId", (q) => q.eq("timelineItemId", item._id))
        .first();
      if (update) {
        await deleteStorageIfExists(ctx, update.photoId, keepStorageIds);
        await deleteStorageIfExists(ctx, update.thumbnailId, keepStorageIds);
        await ctx.db.delete(update._id);
      }
      await ctx.db.delete(item._id);
      return;
    }
    case "encouragement": {
      const encouragement = await ctx.db
        .query("encouragements")
        .withIndex("by_timelineItemId", (q) => q.eq("timelineItemId", item._id))
        .first();
      if (encouragement) {
        await ctx.db.delete(encouragement._id);
      }
      await ctx.db.delete(item._id);
      return;
    }
  }
}

async function clearFeedBatchForBaby(
  ctx: MutationCtx,
  babyId: Id<"baby">,
  keepStorageIds: Set<string>,
) {
  const items = await ctx.db
    .query("timelineItems")
    .withIndex("by_babyId_postedAt", (q) => q.eq("babyId", babyId))
    .take(CLEAR_BATCH_SIZE);

  for (const item of items) {
    await deleteTimelineItem(ctx, item, keepStorageIds);
  }

  return { deleted: items.length, hasMore: items.length === CLEAR_BATCH_SIZE };
}

async function clearAllFeed(ctx: MutationCtx, babyId: Id<"baby">, keepStorageIds: Set<string>) {
  for (;;) {
    const result = await clearFeedBatchForBaby(ctx, babyId, keepStorageIds);
    if (!result.hasMore) break;
  }

  const baby = await ctx.db.get(babyId);
  if (!baby) return;
  await deleteStorageIfExists(ctx, baby.photoId, keepStorageIds);
  await deleteStorageIfExists(ctx, baby.thumbnailId, keepStorageIds);
  await ctx.db.patch(babyId, {
    photoId: null,
    thumbnailId: null,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
  });
}

function slugAuthor(authorName: string) {
  return authorName.toLowerCase().replace(/\s+/g, "-");
}

async function insertFeedDocs(
  ctx: MutationCtx,
  opts: { babyId: Id<"baby">; photos: DemoPhotos; now: number },
) {
  const babyId = opts.babyId;
  const photos = opts.photos;
  const now = opts.now;
  const milestoneIso: Partial<Record<Milestone, string>> = {};
  let pagePhotoId: Id<"_storage"> | null = null;
  let pageThumbnailId: Id<"_storage"> | null = null;

  // Oldest first so the last photo we see is the newest (page photo).
  const chronological = [...HOMEPAGE_DEMO_FEED].sort((a, b) => b.minutesAgo - a.minutesAgo);

  for (const item of chronological) {
    const postedAt = now - item.minutesAgo * 60_000;
    if (item.kind === "encouragement") {
      const timelineItemId = await insertEncouragementTimelineItem(ctx, {
        babyId,
        postedAt,
      });
      await ctx.db.insert("encouragements", {
        babyId,
        authorName: item.authorName,
        message: item.message,
        createdAt: postedAt,
        timelineItemId,
        visitorId: `homepage-demo-${slugAuthor(item.authorName)}`,
      });
      continue;
    }

    const photo = item.photo ? photos[item.photo] : undefined;
    await insertUpdateWithTimelineItem(ctx, {
      babyId,
      postedAt,
      message: item.message,
      milestone: item.milestone ?? null,
      occurredAt: item.milestone ? postedAt : null,
      photoId: photo?.photoId ?? null,
      thumbnailId: photo?.thumbnailId ?? null,
    });

    if (item.milestone) {
      milestoneIso[item.milestone] = new Date(postedAt).toISOString();
    }
    if (photo) {
      pagePhotoId = photo.photoId;
      pageThumbnailId = photo.thumbnailId ?? null;
    }
  }

  await ctx.db.patch(babyId, {
    laborStarted: milestoneIso.labor_started ?? null,
    wentToHospital: milestoneIso.gone_to_hospital ?? null,
    babyBorn: milestoneIso.born ?? null,
    photoId: pagePhotoId,
    thumbnailId: pageThumbnailId,
    // Legacy per-stage message fields stay empty; copy lives on the timeline.
    laborStartedMessage: null,
    hospitalMessage: null,
    babyBornMessage: null,
  });

  return { babyId, publicId: HOMEPAGE_DEMO_BABY.publicId };
}

/**
 * Upload URL for homepage-demo photos. Called from the deploy/seed script
 * (admin `convex run`), not from the browser.
 */
export const generateUploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const ensureBaby = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ensureBabyDoc(ctx, Date.now());
  },
});

export const clearFeedBatch = internalMutation({
  args: {
    babyId: v.id("baby"),
    keepStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    return await clearFeedBatchForBaby(ctx, args.babyId, new Set(args.keepStorageIds ?? []));
  },
});

export const insertFeed = internalMutation({
  args: {
    babyId: v.id("baby"),
    photos: v.optional(photosValidator),
  },
  handler: async (ctx, args) => {
    return await insertFeedDocs(ctx, {
      babyId: args.babyId,
      photos: args.photos ?? {},
      now: Date.now(),
    });
  },
});

/**
 * Idempotent upsert: creates the public demo baby (or reuses it), wipes the
 * feed — including visitor encouragements — and restores the fixture story
 * with timestamps relative to now. Does not send push notifications.
 */
export const refresh = internalMutation({
  args: {
    photos: v.optional(photosValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const photos = args.photos ?? {};
    const babyId = await ensureBabyDoc(ctx, now);
    await clearAllFeed(ctx, babyId, storageIdsToKeep(photos));
    return await insertFeedDocs(ctx, { babyId, photos, now });
  },
});
