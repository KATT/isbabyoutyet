import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "./_generated/schema";
import {
  listByUser,
  getByPublicId,
  generateUploadUrl,
  updatePhoto,
  create,
  getScheduledNotifications,
  cancelScheduledNotification,
  markNotificationSent,
  updateThumbnail,
  update,
} from "./baby";
import babySpec from "./baby.spec";

const listByUserImpl = FunctionImpl.make(databaseSchema, babySpec, "listByUser", listByUser);
const getByPublicIdImpl = FunctionImpl.make(
  databaseSchema,
  babySpec,
  "getByPublicId",
  getByPublicId,
);
const generateUploadUrlImpl = FunctionImpl.make(
  databaseSchema,
  babySpec,
  "generateUploadUrl",
  generateUploadUrl,
);
const updatePhotoImpl = FunctionImpl.make(databaseSchema, babySpec, "updatePhoto", updatePhoto);
const createImpl = FunctionImpl.make(databaseSchema, babySpec, "create", create);
const getScheduledNotificationsImpl = FunctionImpl.make(
  databaseSchema,
  babySpec,
  "getScheduledNotifications",
  getScheduledNotifications,
);
const cancelScheduledNotificationImpl = FunctionImpl.make(
  databaseSchema,
  babySpec,
  "cancelScheduledNotification",
  cancelScheduledNotification,
);
const markNotificationSentImpl = FunctionImpl.make(
  databaseSchema,
  babySpec,
  "markNotificationSent",
  markNotificationSent,
);
const updateThumbnailImpl = FunctionImpl.make(
  databaseSchema,
  babySpec,
  "updateThumbnail",
  updateThumbnail,
);
const updateImpl = FunctionImpl.make(databaseSchema, babySpec, "update", update);

export default GroupImpl.make(databaseSchema, babySpec).pipe(
  Layer.provide(listByUserImpl),
  Layer.provide(getByPublicIdImpl),
  Layer.provide(generateUploadUrlImpl),
  Layer.provide(updatePhotoImpl),
  Layer.provide(createImpl),
  Layer.provide(getScheduledNotificationsImpl),
  Layer.provide(cancelScheduledNotificationImpl),
  Layer.provide(markNotificationSentImpl),
  Layer.provide(updateThumbnailImpl),
  Layer.provide(updateImpl),
  GroupImpl.finalize,
);
