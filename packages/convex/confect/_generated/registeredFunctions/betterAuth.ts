import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import betterAuth from "../../betterAuth.impl";

export default RegisteredFunctions.buildForGroup<
  (typeof import("../../betterAuth.spec"))["default"]
>(databaseSchema, betterAuth, RegisteredConvexFunction.make);
