import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import baby from "../../baby.impl";

export default RegisteredFunctions.buildForGroup<(typeof import("../../baby.spec"))["default"]>(
  databaseSchema,
  baby,
  RegisteredConvexFunction.make,
);
