import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { BABY_BLUE_THEME, LEGACY_BABY_BLUE_THEME } from "../src/theme";
import { backfillBabyBlueThemeDoc } from "./migrations";
import schema from "./schema";
import { modules } from "./test.setup";

test("Baby Blue migration renames legacy records and remains idempotent", async () => {
  const t = convexTest(schema, modules);
  const babyId = await t.run(async (ctx) => {
    return await ctx.db.insert("baby", {
      userId: "alice",
      ownerTokenIdentifier: "https://convex.test|alice",
      name: "Migration Baby",
      dueDate: "2026-09-01",
      dueDateDisplayMode: "exact",
      publicDueDateText: null,
      publicId: "baby-blue-migration",
      birthJourney: "labor",
      theme: LEGACY_BABY_BLUE_THEME,
      lastActivityAt: 1,
      subscriptionCount: 0,
    });
  });

  await t.run(async (ctx) => {
    const baby = await ctx.db.get(babyId);
    if (!baby) throw new Error("Migration fixture missing");
    await backfillBabyBlueThemeDoc(ctx, baby);

    const migrated = await ctx.db.get(babyId);
    if (!migrated) throw new Error("Migrated baby missing");
    await backfillBabyBlueThemeDoc(ctx, migrated);
  });

  expect(await t.run(async (ctx) => await ctx.db.get(babyId))).toMatchObject({
    theme: BABY_BLUE_THEME,
  });
});
