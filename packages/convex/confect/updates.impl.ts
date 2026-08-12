import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "./_generated/schema";
import { post, setAsCurrentPhoto, remove } from "./updates";
import updatesSpec from "./updates.spec";

const postImpl = FunctionImpl.make(databaseSchema, updatesSpec, "post", post);
const setAsCurrentPhotoImpl = FunctionImpl.make(
  databaseSchema,
  updatesSpec,
  "setAsCurrentPhoto",
  setAsCurrentPhoto,
);
const removeImpl = FunctionImpl.make(databaseSchema, updatesSpec, "remove", remove);

export default GroupImpl.make(databaseSchema, updatesSpec).pipe(
  Layer.provide(postImpl),
  Layer.provide(setAsCurrentPhotoImpl),
  Layer.provide(removeImpl),
  GroupImpl.finalize,
);
