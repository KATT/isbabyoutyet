import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import migrations from "../../migrations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../migrations.spec")["default"]>(databaseSchema, migrations, RegisteredConvexFunction.make);
