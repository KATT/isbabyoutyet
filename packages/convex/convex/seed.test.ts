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
      .withIndex("by_user", (q) => q.eq("userId", "seed-user"))
      .collect();
  });

  expect(docs).toHaveLength(4);
  const statuses = docs.map((baby) => getCurrentStatus(baby).type).sort();
  expect(statuses).toEqual(["born", "gone_to_hospital", "labor_started", "not_yet"]);

  const born = docs.find((baby) => baby.publicId === "demo-baby-born");
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
  expect(updates.map((update) => update.milestone).sort()).toEqual([
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
      .withIndex("by_user", (q) => q.eq("userId", String(authUser._id)))
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
        .withIndex("by_user", (q) => q.eq("userId", first.userId))
        .collect()
    ).length;
  });
  expect(babyCount).toBe(4);
});
