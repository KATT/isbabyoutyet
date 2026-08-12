import { Table } from "@confect/server";
import { GenericId } from "@confect/core";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    babyId: Id("baby"),
    timelineItemId: Id("timelineItems"),
    message: Schema.optional(Schema.NullOr(Schema.String)),
    milestone: Schema.optional(
      Schema.NullOr(Schema.Literals(["labor_started", "gone_to_hospital", "born"])),
    ),
    occurredAt: Schema.optional(Schema.NullOr(Schema.Number)),
    photoId: Schema.optional(Schema.NullOr(GenericId.GenericId("_storage"))),
    thumbnailId: Schema.optional(Schema.NullOr(GenericId.GenericId("_storage"))),
  }),
)
  .index("by_babyId", ["babyId"])
  // Milestone lookups (one row per marked stage) without scanning all of a
  // baby's updates — used on every post/redate/unmark and by migrations
  .index("by_babyId_milestone", ["babyId", "milestone"])
  .index("by_timelineItemId", ["timelineItemId"]);
