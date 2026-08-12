import { FunctionSpec, GroupSpec } from "@confect/core";
import type {
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

export default GroupSpec.make()
  .addFunction(FunctionSpec.convexPublicQuery<typeof listByUser>()("listByUser"))
  .addFunction(FunctionSpec.convexPublicQuery<typeof getByPublicId>()("getByPublicId"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof generateUploadUrl>()("generateUploadUrl"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof updatePhoto>()("updatePhoto"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof create>()("create"))
  .addFunction(
    FunctionSpec.convexPublicQuery<typeof getScheduledNotifications>()("getScheduledNotifications"),
  )
  .addFunction(
    FunctionSpec.convexPublicMutation<typeof cancelScheduledNotification>()(
      "cancelScheduledNotification",
    ),
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof markNotificationSent>()("markNotificationSent"),
  )
  .addFunction(FunctionSpec.convexInternalMutation<typeof updateThumbnail>()("updateThumbnail"))
  .addFunction(FunctionSpec.convexPublicMutation<typeof update>()("update"));
