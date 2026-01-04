import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  babies: defineTable({
    userId: v.string(), // Better-auth user ID
    name: v.string(),
    dueDate: v.string(), // ISO date string
    publicId: v.string(), // Unique shareable ID
    customMessage: v.union(v.string(), v.null()), // Custom message shown when gone to hospital
    laborStarted: v.union(v.string(), v.null()), // ISO date string, nullable
    wentToHospital: v.union(v.string(), v.null()), // ISO date string, nullable
    babyBorn: v.union(v.string(), v.null()), // ISO date string, nullable
  })
    .index("by_user", ["userId"])
    .index("by_publicId", ["publicId"]),
  babyPublicIdHistory: defineTable({
    babyId: v.id("babies"),
    publicId: v.string(), // Historical publicId
  })
    .index("by_publicId", ["publicId"])
    .index("by_babyId", ["babyId"]),
});
