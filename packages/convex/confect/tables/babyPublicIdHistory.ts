import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    babyId: Id("baby"),
    publicId: Schema.String,
  }),
)
  .index("by_publicId", ["publicId"])
  .index("by_babyId", ["babyId"]);
