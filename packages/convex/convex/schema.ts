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
    laborStartedMessage: v.optional(v.union(v.string(), v.null())), // Custom message shown when labour started
    laborStarted: v.optional(v.union(v.string(), v.null())), // ISO date string, nullable
    wentToHospital: v.optional(v.union(v.string(), v.null())), // ISO date string, nullable
    babyBorn: v.optional(v.union(v.string(), v.null())), // ISO date string, nullable
    theme: v.optional(v.union(v.string(), v.null())), // Theme preset name (e.g., "violet-bloom", "twitter")
    encouragementsDisabled: v.optional(v.boolean()), // Whether encouragement form is disabled (default: false)
    photoId: v.optional(v.union(v.id("_storage"), v.null())), // Convex storage ID for baby photo
    thumbnailId: v.optional(v.union(v.id("_storage"), v.null())), // Convex storage ID for baby photo thumbnail
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
      v.literal("photo_added"),
    ), // Type of notification
    customMessage: v.optional(v.union(v.string(), v.null())), // Optional custom message
    createdAt: v.number(), // Creation timestamp
  })
    .index("by_babyId", ["babyId"])
    .index("by_scheduledId", ["scheduledId"]),
  encouragements: defineTable({
    babyId: v.id("baby"), // Reference to the baby
    authorName: v.string(), // Name of the person sending encouragement
    message: v.string(), // The encouragement message
    createdAt: v.number(), // Timestamp
    timelineItemId: v.id("timelineItems"), // Binding to the timeline feed
    // Metadata
    visitorId: v.string(), // Unique visitor ID (stored in localStorage)
    userAgent: v.optional(v.string()), // User agent string
    locale: v.optional(v.string()), // Browser locale (e.g., "en-US")
    timezone: v.optional(v.string()), // Timezone (e.g., "America/New_York")
  })
    .index("by_babyId", ["babyId"])
    .index("by_timelineItemId", ["timelineItemId"]),
  // Binding table for the per-baby feed: owns ordering (postedAt) and the kind
  // discriminator; children (updates/encouragements) point at it via timelineItemId.
  // postedAt is an explicit sort key because _creationTime cannot be backfilled
  // with historical dates.
  timelineItems: defineTable({
    babyId: v.id("baby"),
    kind: v.union(v.literal("update"), v.literal("encouragement")),
    postedAt: v.number(), // ms epoch; backfilled rows carry historical dates
  }).index("by_babyId_postedAt", ["babyId", "postedAt"]),
  // Owner-posted feed content: a message and/or a photo, optionally marking a
  // milestone. Each photo change is its own row, so old photos are never lost.
  updates: defineTable({
    babyId: v.id("baby"),
    timelineItemId: v.id("timelineItems"),
    message: v.optional(v.union(v.string(), v.null())),
    milestone: v.optional(
      v.union(
        v.literal("labor_started"),
        v.literal("gone_to_hospital"),
        v.literal("born"),
        v.null(),
      ),
    ),
    photoId: v.optional(v.union(v.id("_storage"), v.null())),
    thumbnailId: v.optional(v.union(v.id("_storage"), v.null())),
  })
    .index("by_babyId", ["babyId"])
    .index("by_timelineItemId", ["timelineItemId"]),
});
