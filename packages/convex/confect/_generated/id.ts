import { GenericId } from "@confect/core";

export type TableNames =
  | "baby"
  | "babyPublicIdHistory"
  | "encouragements"
  | "pushSubscriptions"
  | "scheduledNotifications"
  | "timelineItems"
  | "updates";

export const Id = <const TableName extends TableNames>(tableName: TableName) =>
  GenericId.GenericId(tableName);
