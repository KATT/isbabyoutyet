import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    babyId: Id("baby"),
    kind: Schema.Literals(["update", "encouragement"]),
    postedAt: Schema.Number,
  }),
).index("by_babyId_postedAt", ["babyId", "postedAt"]);
