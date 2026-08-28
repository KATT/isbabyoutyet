import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { DEFAULT_TIME_ZONE } from "../src/timeZone";
import {
  backfillBabyBirthJourneyDoc,
  backfillBabyLastActivityAtDoc,
  backfillBabyOptionalKeysDoc,
  backfillBabySubscriptionCountDoc,
  backfillCoParentInviteOptionalKeysDoc,
  backfillCoParentOptionalKeysDoc,
  backfillEncouragementOptionalKeysDoc,
  backfillEncouragementTimelineDoc,
  backfillPushSubscriptionOptionalKeysDoc,
  backfillScheduledNotificationOptionalKeysDoc,
  backfillTimelineItemOptionalKeysDoc,
  backfillUpdateOptionalKeysDoc,
  backfillUpdatePostedByUserIdDoc,
  backfillUserOnboardingOptionalKeysDoc,
  backfillUserProfileOptionalKeysDoc,
  removeBabyEncouragementsDisabledDoc,
  sanitizeOnboardingStepsDoc,
} from "./migrations";
import schema from "./schema";
import {
  modules,
  registerMigrationsComponent,
  testBabyInsert,
  testCoParentInsert,
  testEncouragementInsert,
  testInviteInsert,
  testNotificationInsert,
  testOnboardingInsert,
  testProfileInsert,
  testSubscriptionInsert,
  testTimelineItemInsert,
  testUpdateInsert,
} from "./test.setup";

function withoutKeys<TDoc extends object>(doc: TDoc, keys: ReadonlyArray<keyof TDoc & string>) {
  const copy: Partial<TDoc> = { ...doc };
  for (const key of keys) {
    delete copy[key];
  }
  return copy as TDoc;
}

test("retained migrations skip linked rows and backfill update metadata and counts", async () => {
  const t = convexTest(schema, modules);
  await registerMigrationsComponent(t);

  const ids = await t.run(async (ctx) => {
    const photoId = await ctx.storage.store(new Blob(["photo"], { type: "image/jpeg" }));
    const babyId = await ctx.db.insert(
      "baby",
      testBabyInsert({
        userId: "alice",
        name: "Migration Baby",
        dueDate: "2026-09-01",
        publicId: "migration-baby",
        photoId,
        lastActivityAt: 1,
        subscriptionCount: 0,
      }),
    );
    const originalItemId = await ctx.db.insert(
      "timelineItems",
      testTimelineItemInsert({
        babyId,
        kind: "encouragement",
        postedAt: 100,
      }),
    );
    const encouragementId = await ctx.db.insert(
      "encouragements",
      testEncouragementInsert({
        babyId,
        authorName: "Grandma",
        message: "Thinking of you!",
        createdAt: 200,
        timelineItemId: originalItemId,
        visitorId: "visitor-1",
      }),
    );
    const updateItemId = await ctx.db.insert(
      "timelineItems",
      testTimelineItemInsert({
        babyId,
        kind: "update",
        postedAt: 500,
      }),
    );
    const updateId = await ctx.db.insert(
      "updates",
      testUpdateInsert({
        babyId,
        timelineItemId: updateItemId,
        message: "Hello",
      }),
    );
    await ctx.db.insert(
      "pushSubscriptions",
      testSubscriptionInsert({
        babyId,
        endpoint: "https://push.example/subscription",
        p256dh: "p256dh",
        auth: "auth",
        createdAt: 300,
      }),
    );
    return { babyId, encouragementId, originalItemId, updateId };
  });

  await t.run(async (ctx) => {
    const baby = await ctx.db.get(ids.babyId);
    const encouragement = await ctx.db.get(ids.encouragementId);
    const update = await ctx.db.get(ids.updateId);
    if (!baby || !encouragement || !update) throw new Error("Fixture missing");

    await backfillEncouragementTimelineDoc(ctx, encouragement);
    await backfillEncouragementTimelineDoc(ctx, {
      ...encouragement,
      timelineItemId: undefined,
    } as unknown as Doc<"encouragements">);
    await backfillUpdatePostedByUserIdDoc(ctx, update);
    const updated = await ctx.db.get(ids.updateId);
    if (!updated) throw new Error("Updated fixture missing");
    await backfillUpdatePostedByUserIdDoc(ctx, updated);
    await backfillBabyBirthJourneyDoc(ctx, {
      ...baby,
      birthJourney: undefined,
    } as unknown as Doc<"baby">);
    await backfillBabyLastActivityAtDoc(ctx, {
      ...baby,
      lastActivityAt: undefined,
    } as unknown as Doc<"baby">);
    await backfillBabySubscriptionCountDoc(ctx, baby);
  });

  const result = await t.run(async (ctx) => {
    return {
      baby: await ctx.db.get(ids.babyId),
      encouragement: await ctx.db.get(ids.encouragementId),
      update: await ctx.db.get(ids.updateId),
    };
  });
  expect(result.encouragement?.timelineItemId).not.toBe(ids.originalItemId);
  expect(result.update?.postedByUserId).toBe("alice");
  expect(result.baby?.lastActivityAt).toBe(result.baby?._creationTime);
  expect(result.baby?.subscriptionCount).toBe(1);

  await expect(
    t.mutation(internal.migrations.runTableMigrations, {
      oneBatchOnly: true,
    }),
  ).resolves.toBeTruthy();
});

test("sanitizeOnboardingSteps strips unknown retired step ids", async () => {
  const t = convexTest(schema, modules);
  await registerMigrationsComponent(t);

  const onboardingId = await t.run(async (ctx) => {
    return await ctx.db.insert(
      "userOnboarding",
      testOnboardingInsert({
        userId: "alice",
        completedSteps: ["add_baby", "share_link"],
      }),
    );
  });

  await t.run(async (ctx) => {
    const onboarding = await ctx.db.get(onboardingId);
    if (!onboarding) throw new Error("Fixture missing");
    const legacyOnboarding = {
      ...onboarding,
      completedSteps: ["add_baby", "retired_step", "share_link", "learn_encouragements"],
    };
    await sanitizeOnboardingStepsDoc(ctx, legacyOnboarding);
    const updated = await ctx.db.get(onboardingId);
    if (!updated) throw new Error("Fixture missing");
    await sanitizeOnboardingStepsDoc(ctx, updated);
  });

  const onboarding = await t.run(async (ctx) => ctx.db.get(onboardingId));
  expect(onboarding?.completedSteps).toEqual(["add_baby", "share_link", "learn_encouragements"]);
});

test("removeBabyEncouragementsDisabled strips the retired flag from baby docs", async () => {
  const t = convexTest(schema, modules);
  await registerMigrationsComponent(t);

  const babyId = await t.run(async (ctx) => {
    return await ctx.db.insert(
      "baby",
      testBabyInsert({
        userId: "alice",
        name: "Legacy Baby",
        dueDate: "2026-09-01",
        publicId: "legacy-baby",
      }),
    );
  });

  await t.run(async (ctx) => {
    const baby = await ctx.db.get(babyId);
    if (!baby) throw new Error("Fixture missing");
    const legacyBaby = { ...baby, encouragementsDisabled: true };
    await removeBabyEncouragementsDisabledDoc(ctx, legacyBaby);
    const updated = await ctx.db.get(babyId);
    if (!updated) throw new Error("Fixture missing");
    await removeBabyEncouragementsDisabledDoc(ctx, updated);
  });

  const baby = await t.run(async (ctx) => ctx.db.get(babyId));
  expect(baby).not.toHaveProperty("encouragementsDisabled");
});

test("optional-key backfills are idempotent and do not clobber set values", async () => {
  const t = convexTest(schema, modules);
  await registerMigrationsComponent(t);

  const ids = await t.run(async (ctx) => {
    const sparseBabyId = await ctx.db.insert(
      "baby",
      testBabyInsert({
        userId: "alice",
        name: "Sparse Baby",
        dueDate: "2026-09-01",
        publicId: "sparse-baby",
      }),
    );
    const themedBabyId = await ctx.db.insert(
      "baby",
      testBabyInsert({
        userId: "alice",
        name: "Themed Baby",
        dueDate: "2026-09-01",
        publicId: "themed-baby",
        theme: "violet-bloom",
        demo: true,
      }),
    );
    const sparseProfileId = await ctx.db.insert(
      "userProfiles",
      testProfileInsert({
        userId: "alice",
        locale: "en-GB",
      }),
    );
    const zonedProfileId = await ctx.db.insert(
      "userProfiles",
      testProfileInsert({
        userId: "bob",
        locale: "en-GB",
        timeZone: "America/New_York",
      }),
    );
    const subscriptionId = await ctx.db.insert(
      "pushSubscriptions",
      testSubscriptionInsert({
        babyId: sparseBabyId,
        endpoint: "https://push.example/sparse",
        p256dh: "p256dh",
        auth: "auth",
        createdAt: 300,
      }),
    );
    const notificationId = await ctx.db.insert(
      "scheduledNotifications",
      testNotificationInsert({
        babyId: sparseBabyId,
        status: "pending",
        scheduledFor: 400,
        notificationType: "photo_added",
        createdAt: 400,
      }),
    );
    const encouragementItemId = await ctx.db.insert(
      "timelineItems",
      testTimelineItemInsert({
        babyId: sparseBabyId,
        kind: "encouragement",
        postedAt: 100,
      }),
    );
    const encouragementId = await ctx.db.insert(
      "encouragements",
      testEncouragementInsert({
        babyId: sparseBabyId,
        authorName: "Grandma",
        message: "Soon!",
        createdAt: 100,
        timelineItemId: encouragementItemId,
        visitorId: "visitor-1",
      }),
    );
    const updateItemId = await ctx.db.insert(
      "timelineItems",
      testTimelineItemInsert({
        babyId: sparseBabyId,
        kind: "update",
        postedAt: 500,
      }),
    );
    const updateId = await ctx.db.insert(
      "updates",
      testUpdateInsert({
        babyId: sparseBabyId,
        timelineItemId: updateItemId,
        message: "Hello",
      }),
    );
    const onboardingId = await ctx.db.insert(
      "userOnboarding",
      testOnboardingInsert({
        userId: "alice",
        completedSteps: ["add_baby"],
      }),
    );
    const coParentId = await ctx.db.insert(
      "babyCoParents",
      testCoParentInsert({
        babyId: sparseBabyId,
        userId: "co",
        email: "co@example.com",
        addedByUserId: "alice",
        addedAt: 600,
      }),
    );
    const inviteId = await ctx.db.insert(
      "babyCoParentInvites",
      testInviteInsert({
        babyId: sparseBabyId,
        email: "invite@example.com",
        invitedByUserId: "alice",
        createdAt: 700,
      }),
    );
    return {
      sparseBabyId,
      themedBabyId,
      sparseProfileId,
      zonedProfileId,
      subscriptionId,
      notificationId,
      encouragementItemId,
      encouragementId,
      updateItemId,
      updateId,
      onboardingId,
      coParentId,
      inviteId,
    };
  });

  async function runBackfills(omitKeys: boolean) {
    await t.run(async (ctx) => {
      const sparseBaby = await ctx.db.get(ids.sparseBabyId);
      const themedBaby = await ctx.db.get(ids.themedBabyId);
      const sparseProfile = await ctx.db.get(ids.sparseProfileId);
      const zonedProfile = await ctx.db.get(ids.zonedProfileId);
      const subscription = await ctx.db.get(ids.subscriptionId);
      const notification = await ctx.db.get(ids.notificationId);
      const encouragementItem = await ctx.db.get(ids.encouragementItemId);
      const encouragement = await ctx.db.get(ids.encouragementId);
      const updateItem = await ctx.db.get(ids.updateItemId);
      const update = await ctx.db.get(ids.updateId);
      const onboarding = await ctx.db.get(ids.onboardingId);
      const coParent = await ctx.db.get(ids.coParentId);
      const invite = await ctx.db.get(ids.inviteId);
      if (
        !sparseBaby ||
        !themedBaby ||
        !sparseProfile ||
        !zonedProfile ||
        !subscription ||
        !notification ||
        !encouragementItem ||
        !encouragement ||
        !updateItem ||
        !update ||
        !onboarding ||
        !coParent ||
        !invite
      ) {
        throw new Error("Fixture missing");
      }
      await backfillBabyOptionalKeysDoc(
        ctx,
        omitKeys
          ? withoutKeys(sparseBaby, [
              "theme",
              "locale",
              "photoId",
              "thumbnailId",
              "blurDataUrl",
              "demo",
              "deletedAt",
            ])
          : sparseBaby,
      );
      await backfillBabyOptionalKeysDoc(
        ctx,
        omitKeys
          ? withoutKeys(themedBaby, [
              "locale",
              "photoId",
              "thumbnailId",
              "blurDataUrl",
              "deletedAt",
            ])
          : themedBaby,
      );
      await backfillUserProfileOptionalKeysDoc(
        ctx,
        omitKeys ? withoutKeys(sparseProfile, ["timeZone"]) : sparseProfile,
      );
      await backfillUserProfileOptionalKeysDoc(ctx, zonedProfile);
      await backfillPushSubscriptionOptionalKeysDoc(
        ctx,
        omitKeys ? withoutKeys(subscription, ["userAgent"]) : subscription,
      );
      await backfillScheduledNotificationOptionalKeysDoc(
        ctx,
        omitKeys
          ? withoutKeys(notification, ["scheduledId", "customMessage", "photoId", "updateId"])
          : notification,
      );
      await backfillTimelineItemOptionalKeysDoc(
        ctx,
        omitKeys ? withoutKeys(encouragementItem, ["deletedAt"]) : encouragementItem,
      );
      await backfillEncouragementOptionalKeysDoc(
        ctx,
        omitKeys
          ? withoutKeys(encouragement, [
              "demoFixture",
              "userAgent",
              "locale",
              "timezone",
              "deletedAt",
            ])
          : encouragement,
      );
      await backfillTimelineItemOptionalKeysDoc(
        ctx,
        omitKeys ? withoutKeys(updateItem, ["deletedAt"]) : updateItem,
      );
      await backfillUpdateOptionalKeysDoc(
        ctx,
        omitKeys
          ? withoutKeys(update, [
              "milestone",
              "occurredAt",
              "photoId",
              "thumbnailId",
              "blurDataUrl",
              "pushImageId",
              "deletedAt",
            ])
          : update,
      );
      await backfillUserOnboardingOptionalKeysDoc(
        ctx,
        omitKeys
          ? withoutKeys(onboarding, ["activeCoachmarkStepId", "restartHintVisible"])
          : onboarding,
      );
      await backfillCoParentOptionalKeysDoc(
        ctx,
        omitKeys ? withoutKeys(coParent, ["name", "deletedAt"]) : coParent,
      );
      await backfillCoParentInviteOptionalKeysDoc(
        ctx,
        omitKeys ? withoutKeys(invite, ["deletedAt"]) : invite,
      );
    });
  }

  await runBackfills(true);
  await runBackfills(false);

  const result = await t.run(async (ctx) => {
    return {
      sparseBaby: await ctx.db.get(ids.sparseBabyId),
      themedBaby: await ctx.db.get(ids.themedBabyId),
      sparseProfile: await ctx.db.get(ids.sparseProfileId),
      zonedProfile: await ctx.db.get(ids.zonedProfileId),
      subscription: await ctx.db.get(ids.subscriptionId),
      notification: await ctx.db.get(ids.notificationId),
      encouragementItem: await ctx.db.get(ids.encouragementItemId),
      encouragement: await ctx.db.get(ids.encouragementId),
      updateItem: await ctx.db.get(ids.updateItemId),
      update: await ctx.db.get(ids.updateId),
      onboarding: await ctx.db.get(ids.onboardingId),
      coParent: await ctx.db.get(ids.coParentId),
      invite: await ctx.db.get(ids.inviteId),
    };
  });

  expect(result.sparseBaby).toMatchObject({
    theme: null,
    locale: null,
    photoId: null,
    thumbnailId: null,
    blurDataUrl: null,
    demo: false,
    deletedAt: null,
  });
  expect(result.themedBaby).toMatchObject({
    theme: "violet-bloom",
    locale: null,
    demo: true,
    deletedAt: null,
  });
  expect(result.sparseProfile?.timeZone).toBe(DEFAULT_TIME_ZONE);
  expect(result.zonedProfile?.timeZone).toBe("America/New_York");
  expect(result.subscription?.userAgent).toBeNull();
  expect(result.notification).toMatchObject({
    scheduledId: null,
    customMessage: null,
    photoId: null,
    updateId: null,
  });
  expect(result.encouragementItem?.deletedAt).toBeNull();
  expect(result.encouragement).toMatchObject({
    demoFixture: false,
    userAgent: null,
    locale: null,
    timezone: null,
    deletedAt: null,
  });
  expect(result.updateItem?.deletedAt).toBeNull();
  expect(result.update).toMatchObject({
    message: "Hello",
    milestone: null,
    occurredAt: null,
    photoId: null,
    thumbnailId: null,
    blurDataUrl: null,
    pushImageId: null,
    deletedAt: null,
  });
  expect(result.onboarding).toMatchObject({
    activeCoachmarkStepId: null,
    restartHintVisible: false,
  });
  expect(result.coParent).toMatchObject({
    name: null,
    deletedAt: null,
  });
  expect(result.invite?.deletedAt).toBeNull();
});
