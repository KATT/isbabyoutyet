import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules, registerComponents } from "./test.setup";

const STATUS_PUBLIC_ID = "mobile-overflow-status-test";
const CONTENT_PUBLIC_ID = "mobile-overflow-content-test";

test("seeds isolated mobile overflow fixtures idempotently", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);

  const first = await t.mutation(internal.mobileOverflowTestSeed.seed, {});
  expect(first.publicIds).toEqual([STATUS_PUBLIC_ID, CONTENT_PUBLIC_ID]);

  const fixtures = await t.run(async (ctx) => {
    const statusBaby = await ctx.db
      .query("baby")
      .withIndex("by_publicId", (q) => q.eq("publicId", STATUS_PUBLIC_ID))
      .unique();
    const contentBaby = await ctx.db
      .query("baby")
      .withIndex("by_publicId", (q) => q.eq("publicId", CONTENT_PUBLIC_ID))
      .unique();
    if (!statusBaby || !contentBaby) throw new Error("missing overflow fixture");

    const encouragements = await ctx.db
      .query("encouragements")
      .withIndex("by_babyId", (q) => q.eq("babyId", contentBaby._id))
      .collect();
    const statusUpdates = await ctx.db
      .query("updates")
      .withIndex("by_babyId", (q) => q.eq("babyId", statusBaby._id))
      .collect();
    return { statusBaby, contentBaby, encouragements, statusUpdates };
  });

  expect(fixtures.statusBaby.babyBorn).toBeTruthy();
  expect(fixtures.statusUpdates.map((update) => update.milestone).sort()).toEqual([
    "born",
    "gone_to_hospital",
    "labor_started",
  ]);
  expect(fixtures.contentBaby.babyBorn).toBeTruthy();
  expect(fixtures.encouragements).toHaveLength(8);
  expect(fixtures.encouragements.some((row) => row.message.includes("overflow-fixture.test"))).toBe(
    true,
  );
  expect(fixtures.encouragements.some((row) => /\S{200}/.test(row.message))).toBe(true);
  expect(fixtures.encouragements.some((row) => row.message.includes("👶🏽🎉🍼"))).toBe(true);

  await t.mutation(internal.mobileOverflowTestSeed.seed, {});
  const counts = await t.run(async (ctx) => {
    const babies = await ctx.db
      .query("baby")
      .withIndex("by_user", (q) => q.eq("userId", "mobile-overflow-browser-test"))
      .collect();
    const contentBaby = babies.find((baby) => baby.publicId === CONTENT_PUBLIC_ID);
    if (!contentBaby) throw new Error("missing content fixture");
    const encouragements = await ctx.db
      .query("encouragements")
      .withIndex("by_babyId", (q) => q.eq("babyId", contentBaby._id))
      .collect();
    return { babies: babies.length, encouragements: encouragements.length };
  });
  expect(counts).toEqual({ babies: 2, encouragements: 8 });
});
