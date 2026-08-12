import { FunctionSpec, GroupSpec } from "@confect/core";
import type { getCurrentUser } from "./betterAuth";

export default GroupSpec.make().addFunction(
  FunctionSpec.convexPublicQuery<typeof getCurrentUser>()("getCurrentUser"),
);
