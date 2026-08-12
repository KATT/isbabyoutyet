import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "./_generated/schema";
import { subscribe, unsubscribe, getSubscriptions, getPublicKey, isSubscribed } from "./pushSubscriptions";
import pushSubscriptionsSpec from "./pushSubscriptions.spec";

const subscribeImpl = FunctionImpl.make(databaseSchema, pushSubscriptionsSpec, "subscribe", subscribe);
const unsubscribeImpl = FunctionImpl.make(databaseSchema, pushSubscriptionsSpec, "unsubscribe", unsubscribe);
const getSubscriptionsImpl = FunctionImpl.make(databaseSchema, pushSubscriptionsSpec, "getSubscriptions", getSubscriptions);
const getPublicKeyImpl = FunctionImpl.make(databaseSchema, pushSubscriptionsSpec, "getPublicKey", getPublicKey);
const isSubscribedImpl = FunctionImpl.make(databaseSchema, pushSubscriptionsSpec, "isSubscribed", isSubscribed);

export default GroupImpl.make(databaseSchema, pushSubscriptionsSpec).pipe(
  Layer.provide(subscribeImpl),
  Layer.provide(unsubscribeImpl),
  Layer.provide(getSubscriptionsImpl),
  Layer.provide(getPublicKeyImpl),
  Layer.provide(isSubscribedImpl),
  GroupImpl.finalize,
);
