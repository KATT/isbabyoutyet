import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import timeline from "../../timeline.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../timeline.spec")["default"]>(databaseSchema, timeline, RegisteredConvexFunction.make);
