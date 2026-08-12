import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../schema";
import pushNotifications from "../../pushNotifications.impl";

export default RegisteredFunctions.buildForGroup<
  (typeof import("../../pushNotifications.spec"))["default"]
>(databaseSchema, pushNotifications, RegisteredNodeFunction.make);
