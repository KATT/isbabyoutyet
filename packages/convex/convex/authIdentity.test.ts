import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import {
  backfillBabyBirthJourneyDoc,
  backfillBabyLastActivityAtDoc,
  backfillBabyOwnerTokenIdentifierDoc,
  backfillBabySubscriptionCountDoc,
  backfillCoParentTokenIdentifierDoc,
  backfillOnboardingTokenIdentifierDoc,
  backfillProfileTokenIdentifierDoc,
  sanitizeOnboardingStepsDoc,
} from "./migrations";
import schema from "./schema";
import { modules } from "./test.setup";

test("auth identity migrations remain idempotent after backfill", async () => {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const babyId = await ctx.db.insert("baby", {
      userId: "alice",
      ownerTokenIdentifier: "https://convex.test|alice",
      name: "Migration Baby",
      dueDate: "2026-09-01",
      publicId: "migration-baby",
      birthJourney: "labour",
      lastActivityAt: 1,
      subscriptionCount: 99,
    });
    const profileId = await ctx.db.insert("userProfiles", {
      userId: "alice",
      tokenIdentifier: "https://convex.test|alice",
      locale: "en-GB",
      isAdmin: false,
    });
    const onboardingId = await ctx.db.insert("userOnboarding", {
      userId: "alice",
      tokenIdentifier: "https://convex.test|alice",
      completedSteps: ["share_link"],
      welcomeDismissed: false,
      checklistDismissed: false,
      minimized: false,
    });
    const coParentId = await ctx.db.insert("babyCoParents", {
      babyId,
      userId: "bob",
      tokenIdentifier: "https://convex.test|bob",
      email: "bob@example.com",
      addedByUserId: "alice",
      addedAt: 1,
    });
    return { babyId, profileId, onboardingId, coParentId };
  });

  await t.run(async (ctx) => {
    const baby = await ctx.db.get(ids.babyId);
    const profile = await ctx.db.get(ids.profileId);
    const onboarding = await ctx.db.get(ids.onboardingId);
    const coParent = await ctx.db.get(ids.coParentId);
    if (!baby || !profile || !onboarding || !coParent) {
      throw new Error("Migration fixture missing");
    }

    await backfillBabyOwnerTokenIdentifierDoc(ctx, baby);
    await backfillBabyBirthJourneyDoc(ctx, baby);
    await backfillBabyLastActivityAtDoc(ctx, baby);
    await backfillBabySubscriptionCountDoc(ctx, baby);
    await backfillProfileTokenIdentifierDoc(ctx, profile);
    await backfillOnboardingTokenIdentifierDoc(ctx, onboarding);
    await backfillCoParentTokenIdentifierDoc(ctx, coParent);
    await sanitizeOnboardingStepsDoc(ctx, onboarding);

    await backfillBabyOwnerTokenIdentifierDoc(ctx, baby);
    await backfillBabyBirthJourneyDoc(ctx, baby);
    await backfillBabyLastActivityAtDoc(ctx, baby);
    await backfillBabySubscriptionCountDoc(ctx, baby);
    await backfillProfileTokenIdentifierDoc(ctx, profile);
    await backfillOnboardingTokenIdentifierDoc(ctx, onboarding);
    await backfillCoParentTokenIdentifierDoc(ctx, coParent);
    await sanitizeOnboardingStepsDoc(ctx, onboarding);
  });

  const migrated = await t.run(async (ctx) => {
    return {
      baby: await ctx.db.get(ids.babyId),
      profile: await ctx.db.get(ids.profileId),
      onboarding: await ctx.db.get(ids.onboardingId),
      coParent: await ctx.db.get(ids.coParentId),
    };
  });

  expect(migrated.baby?.ownerTokenIdentifier).toBe("https://convex.test|alice");
  expect(migrated.baby?.birthJourney).toBe("labour");
  expect(migrated.baby?.lastActivityAt).toBe(1);
  expect(migrated.baby?.subscriptionCount).toBe(0);
  expect(migrated.profile?.tokenIdentifier).toBe("https://convex.test|alice");
  expect(migrated.onboarding?.tokenIdentifier).toBe("https://convex.test|alice");
  expect(migrated.onboarding?.completedSteps).toEqual(["share_link"]);
  expect(migrated.coParent?.tokenIdentifier).toBe("https://convex.test|bob");
});
