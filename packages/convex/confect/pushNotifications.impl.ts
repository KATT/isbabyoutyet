import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "./_generated/schema";
import { sendNotification } from "./pushNotifications";
import pushNotificationsSpec from "./pushNotifications.spec";

const sendNotificationImpl = FunctionImpl.make(databaseSchema, pushNotificationsSpec, "sendNotification", sendNotification);

export default GroupImpl.make(databaseSchema, pushNotificationsSpec).pipe(
  Layer.provide(sendNotificationImpl),
  GroupImpl.finalize,
);
