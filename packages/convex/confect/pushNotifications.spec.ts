import { FunctionSpec, GroupSpec } from "@confect/core";
import type { sendNotification } from "./pushNotifications";

export default GroupSpec.makeNode()
  .addFunction(FunctionSpec.convexInternalNodeAction<typeof sendNotification>()("sendNotification"));
