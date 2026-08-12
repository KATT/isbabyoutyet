import { Table } from "@confect/server";
import { GenericId } from "@confect/core";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    babyId: Id("baby"),
    scheduledId: Schema.optional(GenericId.GenericId("_scheduled_functions")),
    status: Schema.Literals(["pending", "sent", "cancelled"]),
    scheduledFor: Schema.Number,
    notificationType: Schema.Literals([
      "labor_started",
      "gone_to_hospital",
      "born",
      "photo_added",
    ]),
    customMessage: Schema.optional(Schema.NullOr(Schema.String)),
    createdAt: Schema.Number,
  }),
)
  .index("by_babyId", ["babyId"])
  .index("by_scheduledId", ["scheduledId"]);
