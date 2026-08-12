import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import seed from "../../seed.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../seed.spec")["default"]>(databaseSchema, seed, RegisteredConvexFunction.make);
