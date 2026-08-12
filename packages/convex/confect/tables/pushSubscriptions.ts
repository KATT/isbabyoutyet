import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    babyId: Id("baby"),
    endpoint: Schema.String,
    p256dh: Schema.String,
    auth: Schema.String,
    createdAt: Schema.Number,
  }),
)
  .index("by_babyId", ["babyId"])
  .index("by_endpoint", ["endpoint"])
  .index("by_babyId_endpoint", ["babyId", "endpoint"]);
