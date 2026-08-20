import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  HOMEPAGE_DEMO_BABIES,
  HOMEPAGE_DEMO_BABY,
  HOMEPAGE_DEMO_OWNER_USER_ID,
  HOMEPAGE_DEMO_THEME,
  isHomepageDemoPublicId,
} from "../src/seedCredentials";
import {
  HOMEPAGE_DEMO_DUE_DATE_MINUTES_AGO,
  HOMEPAGE_DEMO_FEED_SLOTS,
  HOMEPAGE_DEMO_PHOTO_KEYS,
  homepageDemoFeedFor,
  homepageDemoLocales,
} from "../src/homepageDemoFeed";
import type { HomepageDemoPhotoKey } from "../src/homepageDemoFeed";
import type { SupportedLocale } from "../src/i18n";
import { DEFAULT_LOCALE } from "../src/i18n";
import { supportedLocaleValidator } from "./i18n";
import { tokenIdentifierForAuthUserId } from "./authIdentity";
import { insertEncouragementTimelineItem, insertUpdateWithTimelineItem } from "./timeline";

const CLEAR_BATCH_SIZE = 32;
const RESET_INACTIVITY_MS = 60 * 60_000;

const photoIdsValidator = v.object({
  photoId: v.id("_storage"),
  thumbnailId: v.optional(v.union(v.id("_storage"), v.null())),
  pushImageId: v.optional(v.union(v.id("_storage"), v.null())),
  blurDataUrl: v.optional(v.union(v.string(), v.null())),
});

const photosValidator = v.record(v.string(), photoIdsValidator);

const localeArg = v.optional(supportedLocaleValidator);

type DemoPhotos = Record<
  string,
  {
    photoId: Id<"_storage">;
    thumbnailId?: Id<"_storage"> | null;
    pushImageId?: Id<"_storage"> | null;
    blurDataUrl?: string | null;
  }
>;

type CompleteDemoPhoto = {
  photoId: Id<"_storage">;
  thumbnailId: Id<"_storage">;
  pushImageId: Id<"_storage">;
  blurDataUrl: string;
};

type CompleteDemoPhotos = Record<HomepageDemoPhotoKey, CompleteDemoPhoto>;

function resolveDemoLocale(locale: SupportedLocale | undefined) {
  return locale ?? DEFAULT_LOCALE;
}

function dueDateIso(now: number) {
  return new Date(now - HOMEPAGE_DEMO_DUE_DATE_MINUTES_AGO * 60_000).toISOString();
}

/**
 * Only wipe/patch babies with the fixed homepage-demo identity. `demo: true`
 * alone is intentionally insufficient because preview login fixtures use it
 * too. The sole exception is the pre-flag Juniper row with the same sentinel
 * owner, token, and reserved public id.
 */
function isManagedHomepageDemo(baby: Doc<"baby">) {
  const hasHomepageIdentity =
    baby.userId === HOMEPAGE_DEMO_OWNER_USER_ID &&
    baby.ownerTokenIdentifier === tokenIdentifierForAuthUserId(HOMEPAGE_DEMO_OWNER_USER_ID) &&
    isHomepageDemoPublicId(baby.publicId);
  if (!hasHomepageIdentity) return false;
  return baby.demo === true || baby.publicId === HOMEPAGE_DEMO_BABY.publicId;
}

function refuseNonDemo(publicId: string) {
  return new Error(
    `Refusing to overwrite non-demo baby "${publicId}". Homepage seed only touches reserved homepage-demo identities.`,
  );
}

async function findBabyByPublicId(ctx: MutationCtx | QueryCtx, publicId: string) {
  return await ctx.db
    .query("baby")
    .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
    .unique();
}

async function storageObjectExists(ctx: MutationCtx | QueryCtx, storageId: Id<"_storage">) {
  return (await ctx.db.system.get(storageId)) !== null;
}

async function reusablePhotosForBaby(
  ctx: MutationCtx | QueryCtx,
  opts: { baby: Doc<"baby">; locale: SupportedLocale },
) {
  const updates = await ctx.db
    .query("updates")
    .withIndex("by_babyId", (q) => q.eq("babyId", opts.baby._id))
    .take(HOMEPAGE_DEMO_FEED_SLOTS.length);
  const photos = {} as Partial<CompleteDemoPhotos>;

  for (const item of homepageDemoFeedFor(opts.locale)) {
    if (item.kind !== "update" || !item.photo) continue;
    const update = updates.find((candidate) => candidate.message === item.message);
    if (!update?.photoId || !update.thumbnailId || !update.pushImageId || !update.blurDataUrl) {
      return null;
    }
    if (
      !(await storageObjectExists(ctx, update.photoId)) ||
      !(await storageObjectExists(ctx, update.thumbnailId)) ||
      !(await storageObjectExists(ctx, update.pushImageId))
    ) {
      return null;
    }
    photos[item.photo] = {
      photoId: update.photoId,
      thumbnailId: update.thumbnailId,
      pushImageId: update.pushImageId,
      blurDataUrl: update.blurDataUrl,
    };
  }

  if (!HOMEPAGE_DEMO_PHOTO_KEYS.every((key) => photos[key] !== undefined)) {
    return null;
  }
  return photos as CompleteDemoPhotos;
}

async function loadReusablePhotos(ctx: MutationCtx | QueryCtx) {
  for (const locale of homepageDemoLocales()) {
    const demo = HOMEPAGE_DEMO_BABIES[locale];
    const baby = await findBabyByPublicId(ctx, demo.publicId);
    if (!baby || !isManagedHomepageDemo(baby)) continue;
    const photos = await reusablePhotosForBaby(ctx, { baby, locale });
    if (photos) return photos;
  }
  return null;
}

async function hasCompleteHomepageDemoSeed(ctx: QueryCtx) {
  for (const locale of homepageDemoLocales()) {
    const baby = await findBabyByPublicId(ctx, HOMEPAGE_DEMO_BABIES[locale].publicId);
    if (!baby || !isManagedHomepageDemo(baby)) return false;
    if (!(await reusablePhotosForBaby(ctx, { baby, locale }))) return false;
  }
  return true;
}

async function hasRecentVisitorEncouragement(
  ctx: MutationCtx,
  opts: { babies: Doc<"baby">[]; since: number },
) {
  for (const baby of opts.babies) {
    const recent = ctx.db
      .query("encouragements")
      .withIndex("by_babyId_and_createdAt", (q) =>
        q.eq("babyId", baby._id).gte("createdAt", opts.since),
      )
      .order("desc");
    for await (const encouragement of recent) {
      if (encouragement.demoFixture !== true) {
        return true;
      }
    }
  }
  return false;
}

async function managedHomepageDemoBabies(ctx: MutationCtx) {
  const babies: Doc<"baby">[] = [];
  for (const locale of homepageDemoLocales()) {
    const baby = await findBabyByPublicId(ctx, HOMEPAGE_DEMO_BABIES[locale].publicId);
    if (baby && isManagedHomepageDemo(baby)) {
      babies.push(baby);
    }
  }
  return babies;
}

async function requireManagedDemoBaby(ctx: MutationCtx, babyId: Id<"baby">) {
  const baby = await ctx.db.get(babyId);
  if (!baby || !isManagedHomepageDemo(baby)) {
    throw new Error(`Refusing to modify baby ${babyId}: not a reserved homepage-demo identity.`);
  }
  return baby;
}

async function ensureBabyDoc(ctx: MutationCtx, opts: { now: number; locale: SupportedLocale }) {
  const demo = HOMEPAGE_DEMO_BABIES[opts.locale];
  const existing = await findBabyByPublicId(ctx, demo.publicId);
  const fields = {
    userId: HOMEPAGE_DEMO_OWNER_USER_ID,
    ownerTokenIdentifier: tokenIdentifierForAuthUserId(HOMEPAGE_DEMO_OWNER_USER_ID),
    name: demo.name,
    theme: HOMEPAGE_DEMO_THEME,
    locale: opts.locale,
    birthJourney: "labor" as const,
    demo: true as const,
    dueDate: dueDateIso(opts.now),
    dueDateDisplayMode: "exact" as const,
    publicDueDateText: null,
    lastActivityAt: opts.now,
  };
  if (existing) {
    if (!isManagedHomepageDemo(existing)) {
      throw refuseNonDemo(demo.publicId);
    }
    await ctx.db.patch(existing._id, fields);
    return existing._id;
  }

  return await ctx.db.insert("baby", {
    ...fields,
    publicId: demo.publicId,
    photoId: null,
    thumbnailId: null,
    subscriptionCount: 0,
  });
}

async function deleteTimelineItem(ctx: MutationCtx, item: Doc<"timelineItems">) {
  switch (item.kind) {
    case "update": {
      const update = await ctx.db
        .query("updates")
        .withIndex("by_timelineItemId", (q) => q.eq("timelineItemId", item._id))
        .first();
      if (update) {
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

async function clearFeedBatchForBaby(ctx: MutationCtx, babyId: Id<"baby">) {
  await requireManagedDemoBaby(ctx, babyId);

  const items = await ctx.db
    .query("timelineItems")
    .withIndex("by_babyId_and_postedAt", (q) => q.eq("babyId", babyId))
    .take(CLEAR_BATCH_SIZE);

  for (const item of items) {
    await deleteTimelineItem(ctx, item);
  }

  return { deleted: items.length, hasMore: items.length === CLEAR_BATCH_SIZE };
}

async function clearAllFeed(ctx: MutationCtx, babyId: Id<"baby">) {
  for (;;) {
    const result = await clearFeedBatchForBaby(ctx, babyId);
    if (!result.hasMore) break;
  }

  await requireManagedDemoBaby(ctx, babyId);
  await ctx.db.patch(babyId, {
    photoId: null,
    thumbnailId: null,
    blurDataUrl: null,
  });
}

function slugAuthor(authorName: string) {
  return authorName.toLowerCase().replace(/\s+/g, "-");
}

async function insertFeedDocs(
  ctx: MutationCtx,
  opts: { babyId: Id<"baby">; photos: DemoPhotos; now: number; locale: SupportedLocale },
) {
  await requireManagedDemoBaby(ctx, opts.babyId);

  const babyId = opts.babyId;
  const photos = opts.photos;
  const now = opts.now;
  const locale = opts.locale;
  const demo = HOMEPAGE_DEMO_BABIES[locale];
  let pagePhotoId: Id<"_storage"> | null = null;
  let pageThumbnailId: Id<"_storage"> | null = null;
  let pageBlurDataUrl: string | null = null;

  // Oldest first so the last photo we see is the newest (page photo).
  const chronological = [...homepageDemoFeedFor(locale)].sort(
    (a, b) => b.minutesAgo - a.minutesAgo,
  );

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
        visitorId: `homepage-demo-${locale}-${slugAuthor(item.authorName)}`,
        demoFixture: true,
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
      pushImageId: photo?.pushImageId ?? null,
      blurDataUrl: photo?.blurDataUrl ?? null,
    });

    if (photo) {
      pagePhotoId = photo.photoId;
      pageThumbnailId = photo.thumbnailId ?? null;
      pageBlurDataUrl = photo.blurDataUrl ?? null;
    }
  }

  await ctx.db.patch(babyId, {
    photoId: pagePhotoId,
    thumbnailId: pageThumbnailId,
    blurDataUrl: pageBlurDataUrl,
  });

  return { babyId, publicId: demo.publicId, locale };
}

/**
 * Upload URL for homepage-demo photos. Prefer `storePhoto` from the seed
 * script: `convex run` auto-starts the local backend, but the upload URL
 * points at 127.0.0.1:3210 which is gone once that process exits.
 */
export const generateUploadUrl = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Store a homepage-demo JPEG via `convex run` so the CLI keeps the local
 * backend alive for the whole call (no HTTP POST to 3210).
 */
export const storePhoto = internalAction({
  args: {
    bytes: v.bytes(),
    contentType: v.literal("image/jpeg"),
  },
  returns: v.id("_storage"),
  handler: async (ctx, args) => {
    return await ctx.storage.store(
      new Blob([new Uint8Array(args.bytes)], { type: args.contentType }),
    );
  },
});

/**
 * Deploy-time sentinel: a complete fixture feed already owns the reusable
 * storage objects, so seeding can skip both the reset and photo uploads.
 */
export const hasCompletePhotoSet = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    return await hasCompleteHomepageDemoSeed(ctx);
  },
});

export const ensureBaby = internalMutation({
  args: { locale: localeArg },
  handler: async (ctx, args) => {
    return await ensureBabyDoc(ctx, {
      now: Date.now(),
      locale: resolveDemoLocale(args.locale),
    });
  },
});

export const clearFeedBatch = internalMutation({
  args: {
    babyId: v.id("baby"),
  },
  handler: async (ctx, args) => {
    return await clearFeedBatchForBaby(ctx, args.babyId);
  },
});

export const insertFeed = internalMutation({
  args: {
    babyId: v.id("baby"),
    photos: v.optional(photosValidator),
    locale: localeArg,
  },
  handler: async (ctx, args) => {
    return await insertFeedDocs(ctx, {
      babyId: args.babyId,
      photos: args.photos ?? {},
      now: Date.now(),
      locale: resolveDemoLocale(args.locale),
    });
  },
});

/**
 * Idempotent upsert: creates the public demo baby for one locale (or reuses
 * it), wipes the feed — including visitor encouragements — and restores the
 * fixture story with timestamps relative to now. Does not send push
 * notifications. Call once per locale from the seed script so each baby stays
 * under mutation limits.
 *
 * Never touches a baby outside the reserved homepage-demo identity. Storage
 * objects are retained because Convex storage IDs have no ownership metadata;
 * deleting one here could invalidate a non-demo update that reused the ID.
 */
export const refresh = internalMutation({
  args: {
    photos: v.optional(photosValidator),
    locale: localeArg,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const photos = args.photos ?? {};
    const locale = resolveDemoLocale(args.locale);
    const babyId = await ensureBabyDoc(ctx, { now, locale });
    await clearAllFeed(ctx, babyId);
    return await insertFeedDocs(ctx, { babyId, photos, now, locale });
  },
});

/**
 * Daily reset for the public demo pages. Only server-marked fixture
 * encouragements are excluded from activity, so a client cannot spoof the
 * guard through visitorId. The activity check, photo lookup, and all resets
 * share one transaction so an encouragement cannot arrive between the check
 * and the wipe.
 */
export const resetIfInactive = internalMutation({
  args: {},
  returns: v.object({
    status: v.union(
      v.literal("reset"),
      v.literal("skipped_recent_encouragement"),
      v.literal("skipped_missing_photos"),
    ),
    resetBabies: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const babies = await managedHomepageDemoBabies(ctx);
    if (
      await hasRecentVisitorEncouragement(ctx, {
        babies,
        since: now - RESET_INACTIVITY_MS,
      })
    ) {
      return { status: "skipped_recent_encouragement" as const, resetBabies: 0 };
    }

    const photos = await loadReusablePhotos(ctx);
    if (!photos) {
      return { status: "skipped_missing_photos" as const, resetBabies: 0 };
    }

    for (const locale of homepageDemoLocales()) {
      const babyId = await ensureBabyDoc(ctx, { now, locale });
      await clearAllFeed(ctx, babyId);
      await insertFeedDocs(ctx, { babyId, photos, now, locale });
    }

    return { status: "reset" as const, resetBabies: homepageDemoLocales().length };
  },
});
