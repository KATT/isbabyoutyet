import { v } from "convex/values";
import { env, mutation, query } from "./_generated/server";
import { requiredEnv } from "./requiredEnv";
import { isActive } from "./softDelete";

export const subscribe = mutation({
  args: {
    babyId: v.id("baby"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  handler: async (ctx, args) => {
    const baby = await ctx.db.get(args.babyId);
    if (!baby || !isActive(baby)) {
      throw new Error("Baby not found");
    }

    // Check if subscription already exists for this babyId and endpoint
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_babyId_endpoint", (q) =>
        q.eq("babyId", args.babyId).eq("endpoint", args.endpoint),
      )
      .first();

    if (existing) {
      // Update existing subscription
      await ctx.db.patch(existing._id, {
        p256dh: args.p256dh,
        auth: args.auth,
      });
      return existing._id;
    }

    // Create new subscription
    const subscriptionId = await ctx.db.insert("pushSubscriptions", {
      babyId: args.babyId,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.babyId, {
      subscriptionCount: (baby.subscriptionCount ?? 0) + 1,
    });

    return subscriptionId;
  },
});

export const unsubscribe = mutation({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (subscription) {
      await ctx.db.delete(subscription._id);
      const baby = await ctx.db.get(subscription.babyId);
      if (baby) {
        await ctx.db.patch(baby._id, {
          subscriptionCount: Math.max(0, (baby.subscriptionCount ?? 0) - 1),
        });
      }
    }
  },
});

export const getSubscriptions = query({
  args: {
    babyId: v.id("baby"),
  },
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_babyId", (q) => q.eq("babyId", args.babyId))
      .collect();

    return subscriptions;
  },
});

export const getPublicKey = query({
  args: {},
  handler: async () => {
    // VAPID public key is safe to expose to clients
    return requiredEnv("VAPID_PUBLIC_KEY", env.VAPID_PUBLIC_KEY);
  },
});

export const isSubscribed = query({
  args: {
    babyId: v.id("baby"),
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_babyId_endpoint", (q) =>
        q.eq("babyId", args.babyId).eq("endpoint", args.endpoint),
      )
      .first();

    return subscription !== null;
  },
});
