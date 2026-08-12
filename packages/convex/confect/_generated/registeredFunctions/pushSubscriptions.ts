import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import pushSubscriptions from "../../pushSubscriptions.impl";

export default RegisteredFunctions.buildForGroup<
  (typeof import("../../pushSubscriptions.spec"))["default"]
>(databaseSchema, pushSubscriptions, RegisteredConvexFunction.make);
