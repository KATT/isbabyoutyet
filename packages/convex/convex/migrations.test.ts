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
import { modules, registerMigrationsComponent } from "./test.setup";

test("retained migrations skip linked rows and backfill update metadata and counts", async () => {
  const t = convexTest(schema, modules);
  await registerMigrationsComponent(t);

  const ids = await t.run(async (ctx) => {
    const photoId = await ctx.storage.store(new Blob(["photo"], { type: "image/jpeg" }));
    const babyId = await ctx.db.insert("baby", {
      userId: "alice",
      ownerTokenIdentifier: "https://convex.test|alice",
      name: "Migration Baby",
      dueDate: "2026-09-01",
      publicId: "migration-baby",
      birthJourney: "labor",
      dueDateDisplayMode: "exact",
      publicDueDateText: null,
      photoId,
      lastActivityAt: 1,
      subscriptionCount: 0,
    });
    const originalItemId = await ctx.db.insert("timelineItems", {
      babyId,
      kind: "encouragement",
      postedAt: 100,
    });
    const encouragementId = await ctx.db.insert("encouragements", {
      babyId,
      authorName: "Grandma",
      message: "Thinking of you!",
      createdAt: 200,
      timelineItemId: originalItemId,
      visitorId: "visitor-1",
    });
    const updateItemId = await ctx.db.insert("timelineItems", {
      babyId,
      kind: "update",
      postedAt: 500,
    });
    const updateId = await ctx.db.insert("updates", {
      babyId,
      timelineItemId: updateItemId,
      message: "Hello",
    });
    await ctx.db.insert("pushSubscriptions", {
      babyId,
      endpoint: "https://push.example/subscription",
      p256dh: "p256dh",
      auth: "auth",
      createdAt: 300,
    });
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
    return await ctx.db.insert("userOnboarding", {
      userId: "alice",
      tokenIdentifier: "https://convex.test|alice",
      completedSteps: ["add_baby", "share_link"],
      welcomeDismissed: false,
      checklistDismissed: false,
      minimized: false,
    });
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
    return await ctx.db.insert("baby", {
      userId: "alice",
      ownerTokenIdentifier: "https://convex.test|alice",
      name: "Legacy Baby",
      dueDate: "2026-09-01",
      publicId: "legacy-baby",
      birthJourney: "labor",
      dueDateDisplayMode: "exact",
      publicDueDateText: null,
      lastActivityAt: 1,
      subscriptionCount: 0,
    });
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

test("optional-key backfills write missing null/false without clobbering set values", async () => {
  const t = convexTest(schema, modules);
  await registerMigrationsComponent(t);

  const ids = await t.run(async (ctx) => {
    const sparseBabyId = await ctx.db.insert("baby", {
      userId: "alice",
      ownerTokenIdentifier: "https://convex.test|alice",
      name: "Sparse Baby",
      dueDate: "2026-09-01",
      publicId: "sparse-baby",
      birthJourney: "labor",
      dueDateDisplayMode: "exact",
      publicDueDateText: null,
      lastActivityAt: 1,
      subscriptionCount: 0,
    });
    const themedBabyId = await ctx.db.insert("baby", {
      userId: "alice",
      ownerTokenIdentifier: "https://convex.test|alice",
      name: "Themed Baby",
      dueDate: "2026-09-01",
      publicId: "themed-baby",
      birthJourney: "labor",
      dueDateDisplayMode: "exact",
      publicDueDateText: null,
      theme: "violet-bloom",
      demo: true,
      lastActivityAt: 1,
      subscriptionCount: 0,
    });
    const sparseProfileId = await ctx.db.insert("userProfiles", {
      userId: "alice",
      tokenIdentifier: "https://convex.test|alice",
      locale: "en-GB",
      isAdmin: false,
    });
    const zonedProfileId = await ctx.db.insert("userProfiles", {
      userId: "bob",
      tokenIdentifier: "https://convex.test|bob",
      locale: "en-GB",
      timeZone: "America/New_York",
      isAdmin: false,
    });
    const subscriptionId = await ctx.db.insert("pushSubscriptions", {
      babyId: sparseBabyId,
      endpoint: "https://push.example/sparse",
      p256dh: "p256dh",
      auth: "auth",
      createdAt: 300,
    });
    const notificationId = await ctx.db.insert("scheduledNotifications", {
      babyId: sparseBabyId,
      status: "pending",
      scheduledFor: 400,
      notificationType: "photo_added",
      createdAt: 400,
    });
    const encouragementItemId = await ctx.db.insert("timelineItems", {
      babyId: sparseBabyId,
      kind: "encouragement",
      postedAt: 100,
    });
    const encouragementId = await ctx.db.insert("encouragements", {
      babyId: sparseBabyId,
      authorName: "Grandma",
      message: "Soon!",
      createdAt: 100,
      timelineItemId: encouragementItemId,
      visitorId: "visitor-1",
    });
    const updateItemId = await ctx.db.insert("timelineItems", {
      babyId: sparseBabyId,
      kind: "update",
      postedAt: 500,
    });
    const updateId = await ctx.db.insert("updates", {
      babyId: sparseBabyId,
      timelineItemId: updateItemId,
      message: "Hello",
    });
    const onboardingId = await ctx.db.insert("userOnboarding", {
      userId: "alice",
      tokenIdentifier: "https://convex.test|alice",
      completedSteps: ["add_baby"],
      welcomeDismissed: false,
      checklistDismissed: false,
      minimized: false,
    });
    const coParentId = await ctx.db.insert("babyCoParents", {
      babyId: sparseBabyId,
      userId: "co",
      tokenIdentifier: "https://convex.test|co",
      email: "co@example.com",
      addedByUserId: "alice",
      addedAt: 600,
    });
    const inviteId = await ctx.db.insert("babyCoParentInvites", {
      babyId: sparseBabyId,
      email: "invite@example.com",
      invitedByUserId: "alice",
      createdAt: 700,
    });
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

  async function runBackfills() {
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
      await backfillBabyOptionalKeysDoc(ctx, sparseBaby);
      await backfillBabyOptionalKeysDoc(ctx, themedBaby);
      await backfillUserProfileOptionalKeysDoc(ctx, sparseProfile);
      await backfillUserProfileOptionalKeysDoc(ctx, zonedProfile);
      await backfillPushSubscriptionOptionalKeysDoc(ctx, subscription);
      await backfillScheduledNotificationOptionalKeysDoc(ctx, notification);
      await backfillTimelineItemOptionalKeysDoc(ctx, encouragementItem);
      await backfillEncouragementOptionalKeysDoc(ctx, encouragement);
      await backfillTimelineItemOptionalKeysDoc(ctx, updateItem);
      await backfillUpdateOptionalKeysDoc(ctx, update);
      await backfillUserOnboardingOptionalKeysDoc(ctx, onboarding);
      await backfillCoParentOptionalKeysDoc(ctx, coParent);
      await backfillCoParentInviteOptionalKeysDoc(ctx, invite);
    });
  }

  await runBackfills();
  await runBackfills();

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
