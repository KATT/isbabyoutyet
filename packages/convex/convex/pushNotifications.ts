"use node";

import { v } from "convex/values";
import webPush from "web-push";
import { api, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { env, internalAction } from "./_generated/server";
import { getPushMessage } from "../src/pushMessages";
import { supportedLocaleValidator } from "./i18n";
import { requiredEnv } from "./requiredEnv";

async function sendNotificationToSubscription(
  ctx: ActionCtx,
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: {
    title: string;
    body: string;
    url: string;
    icon?: string;
    tag?: string;
  },
): Promise<boolean> {
  webPush.setVapidDetails(
    env.VAPID_SUBJECT ?? "mailto:admin@isbabyoutyet.com",
    requiredEnv("VAPID_PUBLIC_KEY", env.VAPID_PUBLIC_KEY),
    requiredEnv("VAPID_PRIVATE_KEY", env.VAPID_PRIVATE_KEY),
  );
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    await webPush.sendNotification(pushSubscription, JSON.stringify(payload));
    return true;
  } catch (error) {
    // Handle specific error types
    if (error instanceof Error) {
      // 410 means the subscription is expired/invalid
      if ("statusCode" in error && (error.statusCode === 410 || error.statusCode === 404)) {
        // Delete invalid subscription
        await ctx.runMutation(api.pushSubscriptions.unsubscribe, {
          endpoint: subscription.endpoint,
        });
      }
    }
    console.error("Failed to send notification:", error);
    return false;
  }
}

export const sendNotification = internalAction({
  args: {
    notificationId: v.id("scheduledNotifications"),
    babyId: v.id("baby"),
    babyName: v.string(),
    publicId: v.string(), // Still need publicId for the URL
    status: v.union(
      v.literal("labor_started"),
      v.literal("gone_to_hospital"),
      v.literal("born"),
      v.literal("photo_added"),
    ),
    customMessage: v.optional(v.union(v.string(), v.null())),
    locale: supportedLocaleValidator,
  },
  handler: async (ctx, args) => {
    // Get all subscriptions for this babyId
    const subscriptions = await ctx.runQuery(api.pushSubscriptions.getSubscriptions, {
      babyId: args.babyId,
    });

    const message = getPushMessage(args.locale, args.status, args.babyName);
    const body = args.customMessage || message.body;

    const url = `/baby/${args.publicId}`;

    // Send notification to all subscribers
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        sendNotificationToSubscription(
          ctx,
          {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
          {
            title: message.title,
            body,
            url,
            icon: "/logo192.png",
            // Unique tag per baby to prevent notifications from different babies replacing each other
            tag: `baby-update-${args.publicId}-${args.status}`,
          },
        ),
      ),
    );

    const successCount = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
    const failureCount = results.length - successCount;

    console.log(`Sent notifications: ${successCount} succeeded, ${failureCount} failed`);

    // Mark the notification as sent
    await ctx.runMutation(internal.baby.markNotificationSent, {
      notificationId: args.notificationId,
    });
  },
});
