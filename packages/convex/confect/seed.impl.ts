import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "./_generated/schema";
import { seedDemoData, seedPreviewData } from "./seed";
import seedSpec from "./seed.spec";

const seedDemoDataImpl = FunctionImpl.make(databaseSchema, seedSpec, "seedDemoData", seedDemoData);
const seedPreviewDataImpl = FunctionImpl.make(
  databaseSchema,
  seedSpec,
  "seedPreviewData",
  seedPreviewData,
);

export default GroupImpl.make(databaseSchema, seedSpec).pipe(
  Layer.provide(seedDemoDataImpl),
  Layer.provide(seedPreviewDataImpl),
  GroupImpl.finalize,
);
