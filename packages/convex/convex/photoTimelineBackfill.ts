import { TableHistory } from "convex-table-history";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalQuery } from "./_generated/server";
import { insertUpdateWithTimelineItem } from "./timeline";

const babyAuditLog = new TableHistory<DataModel, "baby">(components.babyAuditLog);

type PhotoAuditChange = {
  auditTs: number;
  photoId: Id<"_storage">;
  thumbnailId: Id<"_storage"> | null;
};

export type PhotoTimelineInjection = {
  babyId: Id<"baby">;
  babyName: string;
  publicId: string;
  photoId: Id<"_storage">;
  thumbnailId: Id<"_storage"> | null;
  postedAt: number;
  source: "audit_log";
  alreadyInFeed: boolean;
  storageExists: boolean;
  photoUrl: string | null;
};

async function listPhotoAuditChanges(ctx: QueryCtx, babyId: Id<"baby">) {
  const raw: PhotoAuditChange[] = [];
  let cursor: string | null = null;
  let isDone = false;
  const maxTs = Date.now();

  while (!isDone) {
    const page = await babyAuditLog.listDocumentHistory(ctx, babyId, maxTs, {
      numItems: 100,
      cursor,
    });
    for (const entry of page.page) {
      if (entry.isDeleted) continue;
      const doc = entry.doc as Doc<"baby"> | null;
      if (!doc?.photoId) continue;
      raw.push({
        auditTs: entry.ts,
        photoId: doc.photoId,
        thumbnailId: doc.thumbnailId ?? null,
      });
    }
    isDone = page.isDone;
    cursor = page.continueCursor;
  }

  // History pages are newest-first; walk oldest-first and keep photo changes.
  raw.reverse();
  const changes: PhotoAuditChange[] = [];
  let previousPhotoId: Id<"_storage"> | null = null;
  for (const change of raw) {
    if (change.photoId === previousPhotoId) continue;
    changes.push(change);
    previousPhotoId = change.photoId;
  }
  return changes;
}

async function resolvePostedAt(ctx: QueryCtx, opts: { photoId: Id<"_storage">; auditTs: number }) {
  const fileMetadata = await ctx.db.system.get(opts.photoId);
  return fileMetadata?._creationTime ?? opts.auditTs;
}

async function existingPhotoIds(ctx: QueryCtx, babyId: Id<"baby">) {
  const updates = await ctx.db
    .query("updates")
    .withIndex("by_babyId", (q) => q.eq("babyId", babyId))
    .collect();
  return new Set(updates.flatMap((update) => (update.photoId ? [update.photoId] : [])));
}

export async function planPhotoTimelineInjectionsForBaby(ctx: QueryCtx, baby: Doc<"baby">) {
  const feedPhotoIds = await existingPhotoIds(ctx, baby._id);
  const auditChanges = await listPhotoAuditChanges(ctx, baby._id);
  const injections: PhotoTimelineInjection[] = [];

  for (const change of auditChanges) {
    const storageExists = !!(await ctx.db.system.get(change.photoId));
    const postedAt = await resolvePostedAt(ctx, {
      photoId: change.photoId,
      auditTs: change.auditTs,
    });
    injections.push({
      babyId: baby._id,
      babyName: baby.name,
      publicId: baby.publicId,
      photoId: change.photoId,
      thumbnailId: change.thumbnailId,
      postedAt,
      source: "audit_log",
      alreadyInFeed: feedPhotoIds.has(change.photoId),
      storageExists,
      photoUrl: storageExists ? await ctx.storage.getUrl(change.photoId) : null,
    });
  }

  return injections;
}

export async function backfillHistoricalPhotosFromAuditLogDoc(ctx: MutationCtx, baby: Doc<"baby">) {
  const plans = await planPhotoTimelineInjectionsForBaby(ctx, baby);
  for (const plan of plans) {
    if (plan.alreadyInFeed || !plan.storageExists) continue;

    const { updateId } = await insertUpdateWithTimelineItem(ctx, {
      babyId: baby._id,
      postedAt: plan.postedAt,
      photoId: plan.photoId,
      thumbnailId: plan.thumbnailId,
    });

    if (!plan.thumbnailId) {
      await ctx.scheduler.runAfter(0, internal.babyThumbnails.generateThumbnail, {
        babyId: baby._id,
        photoId: plan.photoId,
        updateId,
      });
    }
  }
}

export async function resolveBabyByPublicIdOrSlug(ctx: QueryCtx, slug: string) {
  const baby = await ctx.db
    .query("baby")
    .withIndex("by_publicId", (q) => q.eq("publicId", slug))
    .first();
  if (baby) return baby;

  const historyEntry = await ctx.db
    .query("babyPublicIdHistory")
    .withIndex("by_publicId", (q) => q.eq("publicId", slug))
    .order("desc")
    .first();
  if (!historyEntry) return null;
  return await ctx.db.get(historyEntry.babyId);
}

export const preview = internalQuery({
  args: {
    publicId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const publicIdFilter = args.publicId;
    const resolvedBabies: Doc<"baby">[] = [];

    if (publicIdFilter) {
      const baby = await resolveBabyByPublicIdOrSlug(ctx, publicIdFilter);
      if (baby) resolvedBabies.push(baby);
    } else {
      resolvedBabies.push(...(await ctx.db.query("baby").collect()));
    }

    const allPlans: PhotoTimelineInjection[] = [];
    for (const baby of resolvedBabies) {
      const plans = await planPhotoTimelineInjectionsForBaby(ctx, baby);
      allPlans.push(...plans);
    }

    allPlans.sort((a, b) => a.postedAt - b.postedAt);

    return {
      publicIdFilter: publicIdFilter ?? null,
      totalAuditPhotos: allPlans.length,
      pendingInjections: allPlans.filter((plan) => !plan.alreadyInFeed && plan.storageExists),
      alreadyInFeed: allPlans.filter((plan) => plan.alreadyInFeed),
      missingStorage: allPlans.filter((plan) => !plan.storageExists),
      plans: allPlans,
    };
  },
});
