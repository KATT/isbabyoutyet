import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  baby: defineTable({
    userId: v.string(), // Better-auth user ID
    name: v.string(),
    dueDate: v.string(), // ISO date string
    publicId: v.string(), // Unique shareable ID
    hospitalMessage: v.optional(v.union(v.string(), v.null())), // Custom message shown when gone to hospital
    babyBornMessage: v.optional(v.union(v.string(), v.null())), // Custom message shown when baby is born
    laborStarted: v.optional(v.union(v.string(), v.null())), // ISO date string, nullable
    wentToHospital: v.optional(v.union(v.string(), v.null())), // ISO date string, nullable
    babyBorn: v.optional(v.union(v.string(), v.null())), // ISO date string, nullable
    theme: v.optional(v.union(v.string(), v.null())), // Theme preset name (e.g., "violet-bloom", "twitter")
  })
    .index("by_user", ["userId"])
    .index("by_publicId", ["publicId"]),
  babyPublicIdHistory: defineTable({
    babyId: v.id("baby"),
    publicId: v.string(), // Historical publicId
  })
    .index("by_publicId", ["publicId"])
    .index("by_babyId", ["babyId"]),
  pushSubscriptions: defineTable({
    babyId: v.id("baby"), // Reference to the baby
    endpoint: v.string(), // Web Push endpoint URL
    p256dh: v.string(), // Public key for encryption
    auth: v.string(), // Authentication secret
    createdAt: v.number(), // Timestamp
  })
    .index("by_babyId", ["babyId"])
    .index("by_endpoint", ["endpoint"])
    .index("by_babyId_endpoint", ["babyId", "endpoint"]),
  scheduledNotifications: defineTable({
    babyId: v.id("baby"), // Reference to the baby
    scheduledId: v.optional(v.id("_scheduled_functions")), // The Convex scheduler job ID (set after scheduling)
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("cancelled")), // Current status
    scheduledFor: v.number(), // Timestamp when notification will be sent
    notificationType: v.union(
      v.literal("labor_started"),
      v.literal("gone_to_hospital"),
      v.literal("born"),
    ), // Type of notification
    customMessage: v.optional(v.union(v.string(), v.null())), // Optional custom message
    createdAt: v.number(), // Creation timestamp
  })
    .index("by_babyId", ["babyId"])
    .index("by_scheduledId", ["scheduledId"]),
});
