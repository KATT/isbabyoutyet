import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "./_generated/schema";
import { generateThumbnail } from "./babyThumbnails";
import babyThumbnailsSpec from "./babyThumbnails.spec";

const generateThumbnailImpl = FunctionImpl.make(
  databaseSchema,
  babyThumbnailsSpec,
  "generateThumbnail",
  generateThumbnail,
);

export default GroupImpl.make(databaseSchema, babyThumbnailsSpec).pipe(
  Layer.provide(generateThumbnailImpl),
  GroupImpl.finalize,
);
