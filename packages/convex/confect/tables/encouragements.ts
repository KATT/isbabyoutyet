import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    babyId: Id("baby"),
    authorName: Schema.String,
    message: Schema.String,
    createdAt: Schema.Number,
    // Binding to the timeline feed. Still optional in the schema: making it
    // required is split into a follow-up PR so the schema push can verify the
    // PR 1 backfill completed in prod without blocking this cleanup.
    timelineItemId: Schema.optional(Id("timelineItems")),
    visitorId: Schema.String,
    userAgent: Schema.optional(Schema.String),
    locale: Schema.optional(Schema.String),
    timezone: Schema.optional(Schema.String),
  }),
)
  .index("by_babyId", ["babyId"])
  .index("by_timelineItemId", ["timelineItemId"]);
