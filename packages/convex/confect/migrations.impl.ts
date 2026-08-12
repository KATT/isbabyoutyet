import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "./_generated/schema";
import { run, generateThumbnailsForExistingPhotos, backfillBabyTimeline, backfillEncouragementTimeline, separateMilestoneOccurredAt, runAll } from "./migrations";
import migrationsSpec from "./migrations.spec";

const runImpl = FunctionImpl.make(databaseSchema, migrationsSpec, "run", run);
const generateThumbnailsForExistingPhotosImpl = FunctionImpl.make(databaseSchema, migrationsSpec, "generateThumbnailsForExistingPhotos", generateThumbnailsForExistingPhotos);
const backfillBabyTimelineImpl = FunctionImpl.make(databaseSchema, migrationsSpec, "backfillBabyTimeline", backfillBabyTimeline);
const backfillEncouragementTimelineImpl = FunctionImpl.make(databaseSchema, migrationsSpec, "backfillEncouragementTimeline", backfillEncouragementTimeline);
const separateMilestoneOccurredAtImpl = FunctionImpl.make(databaseSchema, migrationsSpec, "separateMilestoneOccurredAt", separateMilestoneOccurredAt);
const runAllImpl = FunctionImpl.make(databaseSchema, migrationsSpec, "runAll", runAll);

export default GroupImpl.make(databaseSchema, migrationsSpec).pipe(
  Layer.provide(runImpl),
  Layer.provide(generateThumbnailsForExistingPhotosImpl),
  Layer.provide(backfillBabyTimelineImpl),
  Layer.provide(backfillEncouragementTimelineImpl),
  Layer.provide(separateMilestoneOccurredAtImpl),
  Layer.provide(runAllImpl),
  GroupImpl.finalize,
);
