import { FunctionSpec, GroupSpec } from "@confect/core";
import type { seedDemoData, seedPreviewData } from "./seed";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexInternalMutation<typeof seedDemoData>()("seedDemoData"))
  .addFunction(FunctionSpec.convexInternalMutation<typeof seedPreviewData>()("seedPreviewData"));
