import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import encouragements from "../../encouragements.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../encouragements.spec")["default"]>(databaseSchema, encouragements, RegisteredConvexFunction.make);
