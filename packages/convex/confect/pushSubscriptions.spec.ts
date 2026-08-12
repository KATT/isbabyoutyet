import { FunctionSpec, GroupSpec } from "@confect/core";
import type { subscribe, unsubscribe, getSubscriptions, getPublicKey, isSubscribed } from "./pushSubscriptions";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexPublicMutation<typeof subscribe>()("subscribe"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof unsubscribe>()("unsubscribe"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof getSubscriptions>()("getSubscriptions"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof getPublicKey>()("getPublicKey"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof isSubscribed>()("isSubscribed"));
