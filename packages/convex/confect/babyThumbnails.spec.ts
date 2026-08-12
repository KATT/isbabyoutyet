import { FunctionSpec, GroupSpec } from "@confect/core";
import type { generateThumbnail } from "./babyThumbnails";

export default GroupSpec.makeNode()
  .addFunction(FunctionSpec.convexInternalNodeAction<typeof generateThumbnail>()("generateThumbnail"));
