import { Table } from "@confect/server";
import { GenericId } from "@confect/core";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    userId: Schema.String,
    name: Schema.String,
    dueDate: Schema.String,
    publicId: Schema.String,
    hospitalMessage: Schema.optional(Schema.NullOr(Schema.String)),
    babyBornMessage: Schema.optional(Schema.NullOr(Schema.String)),
    laborStartedMessage: Schema.optional(Schema.NullOr(Schema.String)),
    laborStarted: Schema.optional(Schema.NullOr(Schema.String)),
    wentToHospital: Schema.optional(Schema.NullOr(Schema.String)),
    babyBorn: Schema.optional(Schema.NullOr(Schema.String)),
    theme: Schema.optional(Schema.NullOr(Schema.String)),
    encouragementsDisabled: Schema.optional(Schema.Boolean),
    photoId: Schema.optional(Schema.NullOr(GenericId.GenericId("_storage"))),
    thumbnailId: Schema.optional(Schema.NullOr(GenericId.GenericId("_storage"))),
  }),
)
  .index("by_user", ["userId"])
  .index("by_publicId", ["publicId"]);
