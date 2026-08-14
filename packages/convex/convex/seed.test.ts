import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { components, internal } from "./_generated/api";
import schema from "./schema";
import { getCurrentStatus } from "../src/types";
import { DEMO_USER } from "../src/seedCredentials";
import { seedBabiesForUser } from "./seed";
import { modules, registerComponents } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  return t;
}

test("seedBabiesForUser creates one baby per status with timeline content", async () => {
  const t = await setup();

  const babies = await t.run(async (ctx) => {
    return await seedBabiesForUser(ctx, "seed-user");
  });

  expect(babies.map((baby) => baby.state)).toEqual([
    "not_yet",
    "labor_started",
    "gone_to_hospital",
    "born",
  ]);

  const docs = await t.run(async (ctx) => {
    return await ctx.db
      .query("baby")
      .withIndex("by_userId", (q) => q.eq("userId", "seed-user"))
      .collect();
  });

  expect(docs).toHaveLength(4);
  const statuses = docs.map((baby) => getCurrentStatus(baby).type).toSorted();
  expect(statuses).toEqual(["born", "gone_to_hospital", "labor_started", "not_yet"]);

  const born = docs.find((baby) => baby.publicId === "baby-born");
  expect(born?.laborStarted).toBeTruthy();
  expect(born?.wentToHospital).toBeTruthy();
  expect(born?.babyBorn).toBeTruthy();

  const updates = await t.run(async (ctx) => {
    if (!born) throw new Error("missing born baby");
    return await ctx.db
      .query("updates")
      .withIndex("by_babyId", (q) => q.eq("babyId", born._id))
      .collect();
  });
  expect(updates.map((update) => update.milestone).toSorted()).toEqual([
    "born",
    "gone_to_hospital",
    "labor_started",
  ]);

  const encouragements = await t.run(async (ctx) => {
    return await ctx.db.query("encouragements").collect();
  });
  expect(encouragements.length).toBeGreaterThan(0);
  expect(encouragements.every((row) => row.timelineItemId)).toBe(true);
});

test("born demo feed includes noisy encouragements that stress mobile layout", async () => {
  const t = await setup();
  const babies = await t.run(async (ctx) => {
    return await seedBabiesForUser(ctx, "layout-stress-user");
  });
  const born = babies.find((baby) => baby.publicId === "baby-born");
  if (!born) throw new Error("missing born baby");

  const encouragements = await t.run(async (ctx) => {
    return await ctx.db
      .query("encouragements")
      .withIndex("by_babyId", (q) => q.eq("babyId", born.id))
      .collect();
  });

  expect(encouragements.length).toBeGreaterThanOrEqual(10);
  expect(encouragements.some((row) => row.message.includes("layout-stress.example"))).toBe(true);
  expect(encouragements.some((row) => /\S{200}/.test(row.message))).toBe(true);
  expect(encouragements.some((row) => row.message.includes("👶🏽🎉🍼"))).toBe(true);
});

test("seedDemoData creates the demo user and is idempotent", async () => {
  const t = await setup();

  const first = await t.mutation(internal.seed.seedDemoData, {});
  expect(first.success).toBe(true);
  expect(first.email).toBe(DEMO_USER.email);
  expect(first).toMatchObject({ babies: expect.any(Array) });
  if (!("babies" in first) || !first.babies) {
    throw new Error("expected babies on first seed");
  }
  expect(first.babies).toHaveLength(4);

  const authUser = await t.query(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", value: DEMO_USER.email }],
  });
  expect(authUser).toMatchObject({ email: DEMO_USER.email, name: DEMO_USER.name });
  if (!authUser) {
    throw new Error("expected demo auth user");
  }

  const onboarding = await t.run(async (ctx) => {
    return await ctx.db
      .query("userOnboarding")
      .withIndex("by_userId", (q) => q.eq("userId", String(authUser._id)))
      .unique();
  });
  expect(onboarding).toMatchObject({
    welcomeDismissed: true,
    checklistDismissed: true,
  });
  expect(onboarding?.completedSteps.length).toBeGreaterThan(0);

  const second = await t.mutation(internal.seed.seedDemoData, {});
  expect(second).toMatchObject({
    success: true,
    message: "Seed data already exists",
    count: 4,
    email: DEMO_USER.email,
  });

  const babyCount = await t.run(async (ctx) => {
    return (
      await ctx.db
        .query("baby")
        .withIndex("by_userId", (q) => q.eq("userId", first.userId))
        .collect()
    ).length;
  });
  expect(babyCount).toBe(4);
});

test("seedDemoData restores missing fixture encouragements", async () => {
  const t = await setup();
  await t.mutation(internal.seed.seedDemoData, {});
  const born = await t.run(async (ctx) => {
    return await ctx.db
      .query("baby")
      .withIndex("by_publicId", (q) => q.eq("publicId", "baby-born"))
      .unique();
  });
  if (!born) throw new Error("missing born baby");

  await t.run(async (ctx) => {
    const encouragements = await ctx.db
      .query("encouragements")
      .withIndex("by_babyId", (q) => q.eq("babyId", born._id))
      .collect();
    const missing = encouragements.find((row) => row.message.includes("layout-stress.example"));
    if (!missing) throw new Error("missing stress encouragement");
    await ctx.db.delete(missing._id);
    await ctx.db.delete(missing.timelineItemId);
  });

  await t.mutation(internal.seed.seedDemoData, {});

  const restored = await t.run(async (ctx) => {
    return await ctx.db
      .query("encouragements")
      .withIndex("by_babyId", (q) => q.eq("babyId", born._id))
      .collect();
  });
  expect(restored.some((row) => row.message.includes("layout-stress.example"))).toBe(true);
});
