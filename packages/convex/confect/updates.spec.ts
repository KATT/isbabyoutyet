import { FunctionSpec, GroupSpec } from "@confect/core";
import type { post, setAsCurrentPhoto, remove } from "./updates";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexPublicMutation<typeof post>()("post"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof setAsCurrentPhoto>()("setAsCurrentPhoto"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof remove>()("remove"));
