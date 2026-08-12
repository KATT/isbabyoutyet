import { DatabaseSchema as $DatabaseSchema } from "@confect/server";

import baby from "./tables/baby";
import babyPublicIdHistory from "./tables/babyPublicIdHistory";
import encouragements from "./tables/encouragements";
import pushSubscriptions from "./tables/pushSubscriptions";
import scheduledNotifications from "./tables/scheduledNotifications";
import timelineItems from "./tables/timelineItems";
import updates from "./tables/updates";

const databaseSchema: $DatabaseSchema.DatabaseSchema<
  typeof baby |
  typeof babyPublicIdHistory |
  typeof encouragements |
  typeof pushSubscriptions |
  typeof scheduledNotifications |
  typeof timelineItems |
  typeof updates
> = $DatabaseSchema.make({
  baby,
  babyPublicIdHistory,
  encouragements,
  pushSubscriptions,
  scheduledNotifications,
  timelineItems,
  updates,
});

export default databaseSchema;
