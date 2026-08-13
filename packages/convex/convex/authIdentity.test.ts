import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import {
  backfillBabyOwnerTokenIdentifierDoc,
  backfillCoParentTokenIdentifierDoc,
  backfillOnboardingTokenIdentifierDoc,
  backfillProfileTokenIdentifierDoc,
} from "./migrations";
import schema from "./schema";
import { modules } from "./test.setup";

test("auth identity backfills are complete and idempotent", async () => {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const babyId = await ctx.db.insert("baby", {
      userId: "alice",
      name: "Migration Baby",
      dueDate: "2026-09-01",
      publicId: "migration-baby",
    });
    const profileId = await ctx.db.insert("userProfiles", {
      userId: "alice",
      locale: "en-GB",
    });
    const onboardingId = await ctx.db.insert("userOnboarding", {
      userId: "alice",
      completedSteps: [],
      welcomeDismissed: false,
      checklistDismissed: false,
      minimized: false,
    });
    const coParentId = await ctx.db.insert("babyCoParents", {
      babyId,
      userId: "bob",
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
    await backfillProfileTokenIdentifierDoc(ctx, profile);
    await backfillOnboardingTokenIdentifierDoc(ctx, onboarding);
    await backfillCoParentTokenIdentifierDoc(ctx, coParent);

    await backfillBabyOwnerTokenIdentifierDoc(ctx, baby);
    await backfillProfileTokenIdentifierDoc(ctx, profile);
    await backfillOnboardingTokenIdentifierDoc(ctx, onboarding);
    await backfillCoParentTokenIdentifierDoc(ctx, coParent);
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
  expect(migrated.profile?.tokenIdentifier).toBe("https://convex.test|alice");
  expect(migrated.onboarding?.tokenIdentifier).toBe("https://convex.test|alice");
  expect(migrated.coParent?.tokenIdentifier).toBe("https://convex.test|bob");
});
