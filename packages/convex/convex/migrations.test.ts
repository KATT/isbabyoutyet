import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  backfillBabyBirthJourneyDoc,
  backfillBabyLastActivityAtDoc,
  backfillBabySubscriptionCountDoc,
  backfillEncouragementTimelineDoc,
  backfillMissingProfilesPage,
  backfillUpdatePostedByUserIdDoc,
  removeBabyEncouragementsDisabledDoc,
  sanitizeOnboardingStepsDoc,
} from "./migrations";
import schema from "./schema";
import { modules, registerComponents, registerMigrationsComponent } from "./test.setup";
import { createAuth } from "./auth";
import { DEMO_EMPTY_USER } from "../src/seedCredentials";
import { ONBOARDING_STEP_IDS } from "../src/onboardingSteps";

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

test("missing profile backfill defaults locale and completes legacy onboarding", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  await registerMigrationsComponent(t);

  const users = await t.run(async (ctx) => {
    const auth = createAuth(ctx);
    const legacy = await auth.api.signUpEmail({
      body: {
        email: "legacy-profile@example.com",
        password: "password123",
        name: "Legacy Profile",
      },
    });
    const existing = await auth.api.signUpEmail({
      body: {
        email: "existing-profile@example.com",
        password: "password123",
        name: "Existing Profile",
      },
    });
    const demo = await auth.api.signUpEmail({
      body: {
        email: DEMO_EMPTY_USER.email,
        password: DEMO_EMPTY_USER.password,
        name: DEMO_EMPTY_USER.name,
      },
    });
    return {
      legacyId: legacy.user.id,
      existingId: existing.user.id,
      demoId: demo.user.id,
    };
  });

  await t.run(async (ctx) => {
    const profiles = await ctx.db.query("userProfiles").take(100);
    for (const profile of profiles) {
      await ctx.db.delete(profile._id);
    }
    await ctx.db.insert("userProfiles", {
      userId: users.existingId,
      tokenIdentifier: `https://convex.test|${users.existingId}`,
      locale: "sv",
      isAdmin: false,
    });
  });

  const result = await t.run(async (ctx) => await backfillMissingProfilesPage(ctx, null));
  expect(result).toMatchObject({ isDone: true, alreadyRan: false, created: 2 });

  const state = await t.run(async (ctx) => {
    const profiles = await ctx.db.query("userProfiles").take(100);
    const onboarding = await ctx.db.query("userOnboarding").take(100);
    return { profiles, onboarding };
  });
  expect(state.profiles.find((profile) => profile.userId === users.legacyId)).toMatchObject({
    locale: "en-GB",
    isAdmin: false,
  });
  expect(state.profiles.find((profile) => profile.userId === users.existingId)).toMatchObject({
    locale: "sv",
  });
  expect(state.onboarding.find((row) => row.userId === users.legacyId)).toMatchObject({
    completedSteps: [...ONBOARDING_STEP_IDS],
    welcomeDismissed: true,
    checklistDismissed: true,
    minimized: true,
  });
  expect(state.onboarding.find((row) => row.userId === users.demoId)).toBeUndefined();

  await expect(
    t.run(async (ctx) => await backfillMissingProfilesPage(ctx, null)),
  ).resolves.toMatchObject({
    isDone: true,
    alreadyRan: true,
    created: 0,
  });
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
