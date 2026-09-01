"use node";

import type { PaginationResult } from "convex/server";
import { v } from "convex/values";
import webPush from "web-push";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { env, internalAction } from "./_generated/server";
import { babyFeedUrl, babyPageUrl } from "../src/babyFeedUrl";
import { getOwnerPushMessage, getPushMessage } from "../src/pushMessages";
import { supportedLocaleValidator } from "./i18n";
import { notifiableStatusValidator, ownerMessagePushEventValidator } from "./pushValidators";
import { requiredEnv } from "./requiredEnv";

type ShowPushPayload = {
  title: string;
  body: string;
  url: string;
  icon: string | undefined;
  image: string | undefined;
  tag: string | undefined;
  dismiss: false;
};

type DismissPushPayload = {
  dismiss: true;
  tag: string;
};

type PushPayload = ShowPushPayload | DismissPushPayload;

function ownerMessagePushTag(encouragementId: string) {
  return `encouragement-${encouragementId}`;
}

type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function sendNotificationToSubscription(
  ctx: ActionCtx,
  opts: {
    subscription: PushSubscriptionKeys;
    payload: PushPayload;
  },
): Promise<boolean> {
  webPush.setVapidDetails(
    env.VAPID_SUBJECT ?? "mailto:admin@isbabyoutyet.com",
    requiredEnv("VAPID_PUBLIC_KEY", env.VAPID_PUBLIC_KEY),
    requiredEnv("VAPID_PRIVATE_KEY", env.VAPID_PRIVATE_KEY),
  );
  try {
    const pushSubscription = {
      endpoint: opts.subscription.endpoint,
      keys: {
        p256dh: opts.subscription.p256dh,
        auth: opts.subscription.auth,
      },
    };

    await webPush.sendNotification(pushSubscription, JSON.stringify(opts.payload));
    return true;
  } catch (error) {
    // Handle specific error types
    if (error instanceof Error) {
      // 410 means the subscription is expired/invalid
      if ("statusCode" in error && (error.statusCode === 410 || error.statusCode === 404)) {
        // Delete invalid subscription
        await ctx.runMutation(internal.pushSubscriptions.removeByEndpoint, {
          endpoint: opts.subscription.endpoint,
        });
      }
    }
    console.error("Failed to send notification:", error);
    return false;
  }
}

async function sendPayloadToSubscriptionPages(
  ctx: ActionCtx,
  opts: {
    loadPage: (cursor: string | null) => Promise<PaginationResult<PushSubscriptionKeys>>;
    payload: PushPayload;
  },
) {
  let cursor: string | null = null;
  let successCount = 0;
  let failureCount = 0;
  for (;;) {
    const subscriptions = await opts.loadPage(cursor);
    const results = await Promise.allSettled(
      subscriptions.page.map((subscription) =>
        sendNotificationToSubscription(ctx, {
          subscription,
          payload: opts.payload,
        }),
      ),
    );
    const pageSuccessCount = results.filter(
      (result) => result.status === "fulfilled" && result.value === true,
    ).length;
    successCount += pageSuccessCount;
    failureCount += results.length - pageSuccessCount;
    if (subscriptions.isDone) break;
    cursor = subscriptions.continueCursor;
  }

  console.log(`Sent notifications: ${successCount} succeeded, ${failureCount} failed`);
}

export const sendNotification = internalAction({
  args: {
    notificationId: v.id("scheduledNotifications"),
    babyId: v.id("baby"),
    babyName: v.string(),
    publicId: v.string(), // Still need publicId for the URL
    status: notifiableStatusValidator,
    customMessage: v.union(v.string(), v.null()),
    photoId: v.union(v.id("_storage"), v.null()),
    updateId: v.union(v.id("updates"), v.null()),
    locale: supportedLocaleValidator,
  },
  handler: async (ctx, args) => {
    const message = getPushMessage({
      locale: args.locale,
      status: args.status,
      babyName: args.babyName,
    });
    const body = args.customMessage || message.body;

    const url = babyPageUrl(args.publicId);
    const imageStorageId = await ctx.runQuery(internal.baby.resolveNotificationImage, {
      updateId: args.updateId ?? null,
      photoId: args.photoId ?? null,
    });
    const image = imageStorageId
      ? ((await ctx.storage.getUrl(imageStorageId)) ?? undefined)
      : undefined;

    await sendPayloadToSubscriptionPages(ctx, {
      loadPage: async (cursor) => {
        const subscriptions: PaginationResult<Doc<"pushSubscriptions">> = await ctx.runQuery(
          internal.pushSubscriptions.getSubscriptionsPage,
          {
            babyId: args.babyId,
            paginationOpts: { numItems: 100, cursor },
          },
        );
        return {
          ...subscriptions,
          page: subscriptions.page.map((subscription) => ({
            endpoint: subscription.endpoint,
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          })),
        };
      },
      payload: {
        title: message.title,
        body,
        url,
        icon: "/logo192.png",
        image,
        // Unique tag per baby+type so a later generic update doesn't replace a birth notice
        tag: `baby-update-${args.publicId}-${args.status}`,
        dismiss: false,
      },
    });

    // Mark the notification as sent
    await ctx.runMutation(internal.baby.markNotificationSent, {
      notificationId: args.notificationId,
    });
  },
});

async function loadOwnerSubscriptionKeysPage(
  ctx: ActionCtx,
  opts: { babyId: Doc<"ownerPushSubscriptions">["babyId"]; cursor: string | null },
) {
  const subscriptions: PaginationResult<Doc<"ownerPushSubscriptions">> = await ctx.runQuery(
    internal.pushSubscriptions.getOwnerSubscriptionsPage,
    {
      babyId: opts.babyId,
      paginationOpts: { numItems: 100, cursor: opts.cursor },
    },
  );
  return {
    ...subscriptions,
    page: subscriptions.page.map((subscription) => ({
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    })),
  };
}

export const sendOwnerMessageNotification = internalAction({
  args: {
    babyId: v.id("baby"),
    babyName: v.string(),
    publicId: v.string(),
    authorName: v.string(),
    message: v.string(),
    encouragementId: v.id("encouragements"),
    event: ownerMessagePushEventValidator,
    locale: supportedLocaleValidator,
  },
  handler: async (ctx, args) => {
    const copy = getOwnerPushMessage({
      locale: args.locale,
      event: args.event,
      babyName: args.babyName,
      authorName: args.authorName,
      message: args.message,
    });

    await sendPayloadToSubscriptionPages(ctx, {
      loadPage: (cursor) => loadOwnerSubscriptionKeysPage(ctx, { babyId: args.babyId, cursor }),
      payload: {
        title: copy.title,
        body: copy.body,
        url: babyFeedUrl(args.publicId),
        icon: "/logo192.png",
        image: undefined,
        tag: ownerMessagePushTag(args.encouragementId),
        dismiss: false,
      },
    });
  },
});

export const dismissOwnerMessageNotification = internalAction({
  args: {
    babyId: v.id("baby"),
    encouragementId: v.id("encouragements"),
  },
  handler: async (ctx, args) => {
    await sendPayloadToSubscriptionPages(ctx, {
      loadPage: (cursor) => loadOwnerSubscriptionKeysPage(ctx, { babyId: args.babyId, cursor }),
      payload: {
        dismiss: true,
        tag: ownerMessagePushTag(args.encouragementId),
      },
    });
  },
});
