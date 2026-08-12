import { FunctionSpec, GroupSpec } from "@confect/core";
import type { create, update, listByBaby, remove } from "./encouragements";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexPublicMutation<typeof create>()("create"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof update>()("update"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof listByBaby>()("listByBaby"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof remove>()("remove"));
