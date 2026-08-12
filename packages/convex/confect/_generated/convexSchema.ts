import { defineSchema as $defineSchema } from "convex/server";

import baby from "./tables/baby";
import babyPublicIdHistory from "./tables/babyPublicIdHistory";
import encouragements from "./tables/encouragements";
import pushSubscriptions from "./tables/pushSubscriptions";
import scheduledNotifications from "./tables/scheduledNotifications";
import timelineItems from "./tables/timelineItems";
import updates from "./tables/updates";

export default $defineSchema({
  baby: baby.tableDefinition,
  babyPublicIdHistory: babyPublicIdHistory.tableDefinition,
  encouragements: encouragements.tableDefinition,
  pushSubscriptions: pushSubscriptions.tableDefinition,
  scheduledNotifications: scheduledNotifications.tableDefinition,
  timelineItems: timelineItems.tableDefinition,
  updates: updates.tableDefinition,
});
