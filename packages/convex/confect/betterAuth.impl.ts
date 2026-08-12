import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "./_generated/schema";
import { getCurrentUser } from "./betterAuth";
import betterAuthSpec from "./betterAuth.spec";

const getCurrentUserImpl = FunctionImpl.make(databaseSchema, betterAuthSpec, "getCurrentUser", getCurrentUser);

export default GroupImpl.make(databaseSchema, betterAuthSpec).pipe(
  Layer.provide(getCurrentUserImpl),
  GroupImpl.finalize,
);
