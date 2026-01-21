"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import webPush from "web-push";

// Get VAPID keys from environment
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@isbabyoutyet.com";

if (!vapidPublicKey || !vapidPrivateKey) {
  throw new Error(
    "VAPID keys are required. Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.",
  );
}

webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

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
  },
  handler: async (ctx, args) => {
    // Get all subscriptions for this babyId
    const subscriptions = await ctx.runQuery(api.pushSubscriptions.getSubscriptions, {
      babyId: args.babyId,
    });

    // Generate notification content based on status
    let title: string;
    let body: string;

    switch (args.status) {
      case "labor_started":
        title = `${args.babyName} - Labor has started!`;
        body = "Labor has begun. Check for updates!";
        break;
      case "gone_to_hospital":
        title = `${args.babyName} is on the way to the hospital!`;
        body = args.customMessage || "They're heading to the hospital. Check for updates!";
        break;
      case "born":
        title = `${args.babyName} is here! 🎉`;
        body = args.customMessage || "The baby has arrived! Check for updates!";
        break;
      case "photo_added":
        title = `${args.babyName} - New photo! 📸`;
        body = "A new photo has been added. Check it out!";
        break;
    }

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
            title,
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
