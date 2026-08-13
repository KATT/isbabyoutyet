import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { supportedLocaleValidator } from "./i18n";

export default defineSchema({
  baby: defineTable({
    userId: v.string(), // Better-auth user ID
    ownerTokenIdentifier: v.optional(v.string()), // Stable Convex auth identity; required after backfill
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
    locale: v.optional(v.union(supportedLocaleValidator, v.null())), // Optional language override; null/absent inherits the owner's profile
    encouragementsDisabled: v.optional(v.boolean()), // Whether encouragement form is disabled (default: false)
    photoId: v.optional(v.union(v.id("_storage"), v.null())), // Convex storage ID for baby photo
    thumbnailId: v.optional(v.union(v.id("_storage"), v.null())), // Convex storage ID for baby photo thumbnail
    // Homepage live-demo babies only. Seed/refresh refuse to wipe babies without this flag.
    demo: v.optional(v.boolean()),
    // Soft delete: set to ms epoch when deleted; absent/null means active
    deletedAt: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_user", ["userId"])
    .index("by_ownerTokenIdentifier", {
      fields: ["ownerTokenIdentifier"],
      staged: true,
    })
    .index("by_publicId", ["publicId"]),
  userProfiles: defineTable({
    userId: v.string(), // Better Auth user ID
    tokenIdentifier: v.optional(v.string()), // Stable Convex auth identity; required after backfill
    locale: supportedLocaleValidator,
  })
    .index("by_userId", ["userId"])
    .index("by_tokenIdentifier", {
      fields: ["tokenIdentifier"],
      staged: true,
    }),
  languageRequests: defineTable({
    userId: v.string(), // Better Auth user ID
    requestedLocale: v.string(), // Free-form language name or BCP 47 tag
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),
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
    .index("by_babyId_and_status", {
      fields: ["babyId", "status"],
      staged: true,
    })
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
    // Soft delete: set to ms epoch when deleted; absent/null means active
    deletedAt: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_babyId", ["babyId"])
    .index("by_babyId_and_createdAt", {
      fields: ["babyId", "createdAt"],
      staged: true,
    })
    .index("by_timelineItemId", ["timelineItemId"]),
  // Binding table for the per-baby feed: owns ordering (postedAt) and the kind
  // discriminator; children (updates/encouragements) point at it via timelineItemId.
  // postedAt is when the item entered the feed (announce/post time) — never the
  // retrofitted event clock. Milestone event times live on updates.occurredAt.
  timelineItems: defineTable({
    babyId: v.id("baby"),
    kind: v.union(v.literal("update"), v.literal("encouragement")),
    postedAt: v.number(), // ms epoch; feed sort key (when posted/announced)
    // Soft delete: set to ms epoch when deleted; absent/null means active
    deletedAt: v.optional(v.union(v.number(), v.null())),
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
    // When the milestone actually happened (ms). Display-only; does not affect
    // feed order. Null/absent for non-milestone updates.
    occurredAt: v.optional(v.union(v.number(), v.null())),
    photoId: v.optional(v.union(v.id("_storage"), v.null())),
    thumbnailId: v.optional(v.union(v.id("_storage"), v.null())),
    // Who posted this update. Optional until backfill makes it required.
    postedByUserId: v.optional(v.union(v.string(), v.null())),
    // Soft delete: set to ms epoch when deleted; absent/null means active
    deletedAt: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_babyId", ["babyId"])
    // Milestone lookups (one row per marked stage) without scanning all of a
    // baby's updates — used on every post/redate/unmark and by migrations
    .index("by_babyId_milestone", ["babyId", "milestone"])
    .index("by_timelineItemId", ["timelineItemId"]),
  // Per-user first-run guided tour progress. One row per user.
  userOnboarding: defineTable({
    userId: v.string(), // Better Auth user ID
    tokenIdentifier: v.optional(v.string()), // Stable Convex auth identity; required after backfill
    /** Steps the user explicitly completed or acknowledged */
    completedSteps: v.array(v.string()),
    /** Welcome carousel seen or skipped */
    welcomeDismissed: v.boolean(),
    /** Floating checklist dismissed forever (until restart) */
    checklistDismissed: v.boolean(),
    /** Checklist collapsed to a small chip */
    minimized: v.boolean(),
  })
    .index("by_tokenIdentifier", {
      fields: ["tokenIdentifier"],
      staged: true,
    })
    .index("by_user", ["userId"]),
  // Co-parents authorized to manage a baby page (not including the owner).
  babyCoParents: defineTable({
    babyId: v.id("baby"),
    userId: v.string(), // Better Auth user id
    tokenIdentifier: v.optional(v.string()), // Stable Convex auth identity; required after backfill
    email: v.string(), // Denormalized for settings display
    name: v.optional(v.union(v.string(), v.null())),
    addedByUserId: v.string(),
    addedAt: v.number(),
    deletedAt: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_babyId", ["babyId"])
    .index("by_userId", ["userId"])
    .index("by_tokenIdentifier", {
      fields: ["tokenIdentifier"],
      staged: true,
    })
    .index("by_babyId_and_tokenIdentifier", {
      fields: ["babyId", "tokenIdentifier"],
      staged: true,
    })
    .index("by_babyId_userId", ["babyId", "userId"]),
  // Pending co-parent invites for emails that do not yet have an account.
  babyCoParentInvites: defineTable({
    babyId: v.id("baby"),
    email: v.string(), // Normalized lowercase
    invitedByUserId: v.string(),
    createdAt: v.number(),
    deletedAt: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_babyId", ["babyId"])
    .index("by_email", ["email"])
    .index("by_babyId_email", ["babyId", "email"]),
});
