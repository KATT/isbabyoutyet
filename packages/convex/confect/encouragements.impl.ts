import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "./_generated/schema";
import {
  Auth,
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "./_generated/services";
import encouragements from "./encouragements.spec";
import { insertEncouragementTimelineItem } from "./timelineHelpers";

const MAX_NAME_LENGTH = 50;
const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isWithinEditWindow(createdAt: number) {
  return Date.now() - createdAt < EDIT_WINDOW_MS;
}

const create = FunctionImpl.make(
  databaseSchema,
  encouragements,
  "create",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const ctx = yield* MutationCtx;

      const baby = yield* reader
        .table("baby")
        .get(args.babyId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () =>
            Effect.die(new Error("Baby not found")),
          ),
        );

      if (baby.encouragementsDisabled) {
        return yield* Effect.die(
          new Error("Encouragements are disabled for this baby"),
        );
      }

      const trimmedName = args.authorName.trim();
      if (trimmedName.length === 0) {
        return yield* Effect.die(new Error("Name is required"));
      }
      if (trimmedName.length > MAX_NAME_LENGTH) {
        return yield* Effect.die(
          new Error(`Name must be ${MAX_NAME_LENGTH} characters or less`),
        );
      }

      const trimmedMessage = args.message.trim();
      if (trimmedMessage.length === 0) {
        return yield* Effect.die(new Error("Message is required"));
      }

      const createdAt = Date.now();
      const timelineItemId = yield* Effect.promise(() =>
        insertEncouragementTimelineItem(ctx, {
          babyId: args.babyId,
          postedAt: createdAt,
        }),
      );

      return yield* writer.table("encouragements").insert({
        babyId: args.babyId,
        authorName: trimmedName,
        message: trimmedMessage,
        createdAt,
        timelineItemId,
        visitorId: args.visitorId,
        userAgent: args.userAgent,
        locale: args.locale,
        timezone: args.timezone,
      });
    }).pipe(Effect.orDie),
);

const update = FunctionImpl.make(
  databaseSchema,
  encouragements,
  "update",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;

      const encouragement = yield* reader
        .table("encouragements")
        .get(args.encouragementId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () =>
            Effect.die(new Error("Encouragement not found")),
          ),
        );

      if (encouragement.visitorId !== args.visitorId) {
        return yield* Effect.die(
          new Error("Not authorized to edit this encouragement"),
        );
      }

      if (!isWithinEditWindow(encouragement.createdAt)) {
        return yield* Effect.die(
          new Error("Edit window has expired (15 minutes)"),
        );
      }

      const trimmedMessage = args.message.trim();
      if (trimmedMessage.length === 0) {
        return yield* Effect.die(new Error("Message is required"));
      }

      yield* writer.table("encouragements").patch(args.encouragementId, {
        message: trimmedMessage,
      });

      return null;
    }).pipe(Effect.orDie),
);

const listByBaby = FunctionImpl.make(
  databaseSchema,
  encouragements,
  "listByBaby",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;

      return yield* reader
        .table("encouragements")
        .index("by_babyId", (q) => q.eq("babyId", args.babyId), "desc")
        .paginate(args.paginationOpts);
    }).pipe(Effect.orDie),
);

const remove = FunctionImpl.make(
  databaseSchema,
  encouragements,
  "remove",
  (args) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;

      const encouragement = yield* reader
        .table("encouragements")
        .get(args.encouragementId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () =>
            Effect.die(new Error("Encouragement not found")),
          ),
        );

      const baby = yield* reader
        .table("baby")
        .get(encouragement.babyId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () =>
            Effect.die(new Error("Baby not found")),
          ),
        );

      const identity = yield* Auth.getUserIdentity.pipe(
        Effect.catchTag("NoUserIdentityFoundError", () => Effect.succeed(null)),
      );

      const isOwner = identity !== null && baby.userId === identity.subject;

      const canVisitorDelete =
        args.visitorId !== undefined &&
        encouragement.visitorId === args.visitorId &&
        isWithinEditWindow(encouragement.createdAt);

      if (!isOwner && !canVisitorDelete) {
        return yield* Effect.die(
          new Error("Not authorized to delete this encouragement"),
        );
      }

      yield* writer.table("encouragements").delete(args.encouragementId);
      if (encouragement.timelineItemId !== undefined) {
        yield* writer.table("timelineItems").delete(encouragement.timelineItemId);
      }

      return null;
    }).pipe(Effect.orDie),
);

export default GroupImpl.make(databaseSchema, encouragements).pipe(
  Layer.provide(create),
  Layer.provide(update),
  Layer.provide(listByBaby),
  Layer.provide(remove),
  GroupImpl.finalize,
);
