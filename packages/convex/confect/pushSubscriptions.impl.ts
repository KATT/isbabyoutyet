import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "./_generated/schema";
import { DatabaseReader, DatabaseWriter } from "./_generated/services";
import pushSubscriptions from "./pushSubscriptions.spec";

const subscribe = FunctionImpl.make(
  databaseSchema,
  pushSubscriptions,
  "subscribe",
  ({ babyId, endpoint, p256dh, auth }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;

      const existing = yield* reader
        .table("pushSubscriptions")
        .index("by_babyId_endpoint", (q) => q.eq("babyId", babyId).eq("endpoint", endpoint))
        .first();

      if (Option.isSome(existing)) {
        yield* writer.table("pushSubscriptions").patch(existing.value._id, {
          p256dh,
          auth,
        });
        return existing.value._id;
      }

      return yield* writer.table("pushSubscriptions").insert({
        babyId,
        endpoint,
        p256dh,
        auth,
        createdAt: Date.now(),
      });
    }).pipe(Effect.orDie),
);

const unsubscribe = FunctionImpl.make(
  databaseSchema,
  pushSubscriptions,
  "unsubscribe",
  ({ endpoint }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;

      const subscription = yield* reader
        .table("pushSubscriptions")
        .index("by_endpoint", (q) => q.eq("endpoint", endpoint))
        .first();

      if (Option.isSome(subscription)) {
        yield* writer.table("pushSubscriptions").delete(subscription.value._id);
      }

      return null;
    }).pipe(Effect.orDie),
);

const getSubscriptions = FunctionImpl.make(
  databaseSchema,
  pushSubscriptions,
  "getSubscriptions",
  ({ babyId }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;

      return yield* reader
        .table("pushSubscriptions")
        .index("by_babyId", (q) => q.eq("babyId", babyId))
        .collect();
    }).pipe(Effect.orDie),
);

const getPublicKey = FunctionImpl.make(databaseSchema, pushSubscriptions, "getPublicKey", () =>
  Config.string("VAPID_PUBLIC_KEY").pipe(Effect.orDie),
);

const isSubscribed = FunctionImpl.make(
  databaseSchema,
  pushSubscriptions,
  "isSubscribed",
  ({ babyId, endpoint }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;

      const subscription = yield* reader
        .table("pushSubscriptions")
        .index("by_babyId_endpoint", (q) => q.eq("babyId", babyId).eq("endpoint", endpoint))
        .first();

      return Option.isSome(subscription);
    }).pipe(Effect.orDie),
);

export default GroupImpl.make(databaseSchema, pushSubscriptions).pipe(
  Layer.provide(subscribe),
  Layer.provide(unsubscribe),
  Layer.provide(getSubscriptions),
  Layer.provide(getPublicKey),
  Layer.provide(isSubscribed),
  GroupImpl.finalize,
);
