import { FunctionSpec, GroupSpec } from "@confect/core";
import type {
  run,
  generateThumbnailsForExistingPhotos,
  backfillBabyTimeline,
  backfillEncouragementTimeline,
  separateMilestoneOccurredAt,
  runAll,
} from "./migrations";

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexInternalMutation<typeof run>()("run"))
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof generateThumbnailsForExistingPhotos>()(
      "generateThumbnailsForExistingPhotos",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof backfillBabyTimeline>()("backfillBabyTimeline"),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof backfillEncouragementTimeline>()(
      "backfillEncouragementTimeline",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof separateMilestoneOccurredAt>()(
      "separateMilestoneOccurredAt",
    ),
  )
  .addFunction(FunctionSpec.convexInternalMutation<typeof runAll>()("runAll"));
