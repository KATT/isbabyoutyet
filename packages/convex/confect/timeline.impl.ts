import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "./_generated/schema";
import type { Docs } from "./_generated/docs";
import { DatabaseReader, StorageReader } from "./_generated/services";
import timelineSpec from "./timeline.spec";

type TimelineItemDoc = Docs["timelineItems"];
type UpdateDoc = Docs["updates"];
type EncouragementDoc = Docs["encouragements"];

/**
 * Resolves a storage URL to a string, matching vanilla `ctx.storage.getUrl`
 * which returns `null` when the blob is missing.
 */
const getStorageUrlString = (storageId: GenericId<"_storage">) =>
  Effect.gen(function* () {
    const storage = yield* StorageReader;
    const url = yield* storage.getUrl(storageId).pipe(
      Effect.catchTag("BlobNotFoundError", () => Effect.succeed(null as URL | null)),
    );
    return url === null ? null : url.href;
  });

const hydrateUpdate = (
  item: TimelineItemDoc,
  update: UpdateDoc,
  currentPhotoId: GenericId<"_storage"> | null,
) =>
  Effect.gen(function* () {
    const photoUrl = update.photoId ? yield* getStorageUrlString(update.photoId) : null;
    const thumbnailUrl = update.thumbnailId
      ? yield* getStorageUrlString(update.thumbnailId)
      : null;
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
  });

/**
 * Public shape of an encouragement in the feed. Deliberately excludes
 * `visitorId` (it is the edit/delete credential) and the `userAgent` /
 * `locale` / `timezone` metadata. `isMine` is computed from the
 * caller-supplied visitorId so the client can offer edit/delete.
 */
function toPublicEncouragement(encouragement: EncouragementDoc, visitorId?: string) {
  return {
    _id: encouragement._id,
    authorName: encouragement.authorName,
    message: encouragement.message,
    createdAt: encouragement.createdAt,
    isMine: visitorId !== undefined && encouragement.visitorId === visitorId,
  };
}

const findUpdateByTimelineItem = (timelineItemId: TimelineItemDoc["_id"]) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    // .first() (not .unique()): a duplicate child row would be a data bug, but
    // it must not take the whole public feed down.
    return yield* reader
      .table("updates")
      .index("by_timelineItemId", (q) => q.eq("timelineItemId", timelineItemId))
      .first();
  });

const findEncouragementByTimelineItem = (timelineItemId: TimelineItemDoc["_id"]) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("encouragements")
      .index("by_timelineItemId", (q) => q.eq("timelineItemId", timelineItemId))
      .first();
  });

const hydrateTimelineItem = (
  item: TimelineItemDoc,
  opts: { visitorId?: string; currentPhotoId: GenericId<"_storage"> | null },
) =>
  Effect.gen(function* () {
    switch (item.kind) {
      case "update": {
        const update = yield* findUpdateByTimelineItem(item._id);
        if (Option.isNone(update)) return null;
        return yield* hydrateUpdate(item, update.value, opts.currentPhotoId);
      }
      case "encouragement": {
        const encouragement = yield* findEncouragementByTimelineItem(item._id);
        if (Option.isNone(encouragement)) return null;
        return {
          _id: item._id,
          kind: "encouragement" as const,
          postedAt: item.postedAt,
          encouragement: toPublicEncouragement(encouragement.value, opts.visitorId),
        };
      }
    }
  });

const getBabyOrNull = (babyId: Docs["baby"]["_id"]) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("baby")
      .get(babyId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
  });

const listByBaby = FunctionImpl.make(
  databaseSchema,
  timelineSpec,
  "listByBaby",
  ({ babyId, visitorId, paginationOpts }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const baby = yield* getBabyOrNull(babyId);
      const currentPhotoId = baby?.photoId ?? null;

      const result = yield* reader
        .table("timelineItems")
        .index("by_babyId_postedAt", (q) => q.eq("babyId", babyId), "desc")
        .paginate(paginationOpts);

      const page = [];
      for (const item of result.page) {
        const hydrated = yield* hydrateTimelineItem(item, {
          visitorId,
          currentPhotoId,
        });
        if (hydrated) {
          page.push(hydrated);
        }
      }

      return { ...result, page };
    }).pipe(Effect.orDie),
);

/**
 * The newest owner update carrying a message — powers the status card's
 * "latest message on top". Message-less (e.g. photo-only) updates are
 * skipped so they don't blank the box while an older message exists.
 *
 * Bounded by the number of owner updates (only the owner creates them), so
 * visitor activity cannot grow this query.
 */
const latestUpdate = FunctionImpl.make(
  databaseSchema,
  timelineSpec,
  "latestUpdate",
  ({ babyId }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const updates = yield* reader
        .table("updates")
        .index("by_babyId", (q) => q.eq("babyId", babyId))
        .collect();

      let latest: { update: UpdateDoc; item: TimelineItemDoc } | null = null;
      for (const update of updates) {
        if (!update.message) continue;
        const item = yield* reader
          .table("timelineItems")
          .get(update.timelineItemId)
          .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
        if (!item) continue;
        if (!latest || item.postedAt > latest.item.postedAt) {
          latest = { update, item };
        }
      }

      if (!latest) return Option.none();

      const baby = yield* getBabyOrNull(babyId);
      const hydrated = yield* hydrateUpdate(
        latest.item,
        latest.update,
        baby?.photoId ?? null,
      );
      return Option.some(hydrated);
    }).pipe(Effect.orDie),
);

export default GroupImpl.make(databaseSchema, timelineSpec).pipe(
  Layer.provide(listByBaby),
  Layer.provide(latestUpdate),
  GroupImpl.finalize,
);
