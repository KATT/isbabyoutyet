import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Id } from "./_generated/id";
import pushSubscriptions from "./_generated/tables/pushSubscriptions";

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "subscribe",
      args: () =>
        Schema.Struct({
          babyId: Id("baby"),
          endpoint: Schema.String,
          p256dh: Schema.String,
          auth: Schema.String,
        }),
      returns: () => Id("pushSubscriptions"),
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "unsubscribe",
      args: () =>
        Schema.Struct({
          endpoint: Schema.String,
        }),
      returns: () => Schema.Null,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getSubscriptions",
      args: () =>
        Schema.Struct({
          babyId: Id("baby"),
        }),
      returns: () => Schema.Array(pushSubscriptions.Doc),
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getPublicKey",
      args: () => Schema.Struct({}),
      returns: () => Schema.String,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "isSubscribed",
      args: () =>
        Schema.Struct({
          babyId: Id("baby"),
          endpoint: Schema.String,
        }),
      returns: () => Schema.Boolean,
    }),
  );
