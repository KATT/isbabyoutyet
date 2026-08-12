import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import updates from "../../updates.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../updates.spec")["default"]>(databaseSchema, updates, RegisteredConvexFunction.make);
