import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../schema";
import babyThumbnails from "../../babyThumbnails.impl";

export default RegisteredFunctions.buildForGroup<
  (typeof import("../../babyThumbnails.spec"))["default"]
>(databaseSchema, babyThumbnails, RegisteredNodeFunction.make);
