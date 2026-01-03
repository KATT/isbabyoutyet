import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  babies: defineTable({
    userId: v.string(), // Better-auth user ID
    name: v.string(),
    dueDate: v.string(), // ISO date string
    publicId: v.string(), // Unique shareable ID
    customMessage: v.optional(v.string()), // Custom message shown when gone to hospital
    laborStarted: v.optional(v.string()), // ISO date string, nullable
    wentToHospital: v.optional(v.string()), // ISO date string, nullable
    babyBorn: v.optional(v.string()), // ISO date string, nullable
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_publicId", ["publicId"]),
});
