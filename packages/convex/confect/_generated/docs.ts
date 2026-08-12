import type { Document } from "@confect/server";
import type schemaDefinition from "./schema";

export type BabyDoc = Document.Document<typeof schemaDefinition, "baby">;
export type BabyPublicIdHistoryDoc = Document.Document<typeof schemaDefinition, "babyPublicIdHistory">;
export type EncouragementsDoc = Document.Document<typeof schemaDefinition, "encouragements">;
export type PushSubscriptionsDoc = Document.Document<typeof schemaDefinition, "pushSubscriptions">;
export type ScheduledNotificationsDoc = Document.Document<typeof schemaDefinition, "scheduledNotifications">;
export type TimelineItemsDoc = Document.Document<typeof schemaDefinition, "timelineItems">;
export type UpdatesDoc = Document.Document<typeof schemaDefinition, "updates">;

export interface Docs {
  baby: BabyDoc;
  babyPublicIdHistory: BabyPublicIdHistoryDoc;
  encouragements: EncouragementsDoc;
  pushSubscriptions: PushSubscriptionsDoc;
  scheduledNotifications: ScheduledNotificationsDoc;
  timelineItems: TimelineItemsDoc;
  updates: UpdatesDoc;
}
