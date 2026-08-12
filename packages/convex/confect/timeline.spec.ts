import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Id } from "./_generated/id";

const milestone = Schema.Literals(["labor_started", "gone_to_hospital", "born"]);

const hydratedUpdate = Schema.Struct({
  _id: Id("timelineItems"),
  kind: Schema.Literals(["update"]),
  postedAt: Schema.Number,
  update: Schema.Struct({
    _id: Id("updates"),
    message: Schema.NullOr(Schema.String),
    milestone: Schema.NullOr(milestone),
    occurredAt: Schema.NullOr(Schema.Number),
    photoUrl: Schema.NullOr(Schema.String),
    thumbnailUrl: Schema.NullOr(Schema.String),
    isCurrentPagePhoto: Schema.Boolean,
  }),
});

const publicEncouragement = Schema.Struct({
  _id: Id("encouragements"),
  authorName: Schema.String,
  message: Schema.String,
  createdAt: Schema.Number,
  isMine: Schema.Boolean,
});

const hydratedEncouragement = Schema.Struct({
  _id: Id("timelineItems"),
  kind: Schema.Literals(["encouragement"]),
  postedAt: Schema.Number,
  encouragement: publicEncouragement,
});

/** Public shape of one hydrated feed row (owner update or visitor encouragement). */
export const timelineItem = Schema.Union([hydratedUpdate, hydratedEncouragement]);

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "listByBaby",
      args: () =>
        Schema.Struct({
          babyId: Id("baby"),
          // The caller's own visitor id, only used to mark their posts with `isMine`
          visitorId: Schema.optionalKey(Schema.String),
        }),
      item: () => timelineItem,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "latestUpdate",
      args: () =>
        Schema.Struct({
          babyId: Id("baby"),
        }),
      returns: () => Schema.OptionFromNullOr(hydratedUpdate),
    }),
  );
