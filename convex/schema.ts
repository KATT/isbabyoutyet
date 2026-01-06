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
    /**
     * @deprecated Use hospitalMessage instead
     */
    customMessage: v.optional(v.union(v.string(), v.null())), // Custom message shown when gone to hospital
  })
    .index("by_user", ["userId"])
    .index("by_publicId", ["publicId"]),
  babyPublicIdHistory: defineTable({
    babyId: v.id("baby"),
    publicId: v.string(), // Historical publicId
  })
    .index("by_publicId", ["publicId"])
    .index("by_babyId", ["babyId"]),
});
