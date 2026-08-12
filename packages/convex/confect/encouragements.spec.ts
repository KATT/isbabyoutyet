import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Id } from "./_generated/id";

const publicEncouragement = Schema.Struct({
  _id: Id("encouragements"),
  authorName: Schema.String,
  message: Schema.String,
  createdAt: Schema.Number,
  isMine: Schema.Boolean,
});

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () =>
        Schema.Struct({
          babyId: Id("baby"),
          authorName: Schema.String,
          message: Schema.String,
          visitorId: Schema.String,
          userAgent: Schema.optionalKey(Schema.String),
          locale: Schema.optionalKey(Schema.String),
          timezone: Schema.optionalKey(Schema.String),
        }),
      returns: () => Id("encouragements"),
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "update",
      args: () =>
        Schema.Struct({
          encouragementId: Id("encouragements"),
          visitorId: Schema.String,
          message: Schema.String,
        }),
      returns: () => Schema.Null,
    }),
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "listByBaby",
      args: () =>
        Schema.Struct({
          babyId: Id("baby"),
          // The caller's own visitor id, only used to mark their posts with `isMine`
          visitorId: Schema.optionalKey(Schema.String),
        }),
      item: () => publicEncouragement,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "remove",
      args: () =>
        Schema.Struct({
          encouragementId: Id("encouragements"),
          visitorId: Schema.optionalKey(Schema.String),
        }),
      returns: () => Schema.Null,
    }),
  );
