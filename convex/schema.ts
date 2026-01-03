import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  babies: defineTable({
    userId: v.string(), // Better-auth user ID
    name: v.string(),
    dueDate: v.string(), // ISO date string
    publicId: v.string(), // Unique shareable ID
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_publicId", ["publicId"]),

  statusUpdates: defineTable({
    babyId: v.id("babies"),
    status: v.union(v.literal("labor_started"), v.literal("gone_to_hospital"), v.literal("born")),
    date: v.string(), // ISO date string
    createdAt: v.number(),
  })
    .index("by_baby", ["babyId"])
    .index("by_baby_status", ["babyId", "status"]),
});
