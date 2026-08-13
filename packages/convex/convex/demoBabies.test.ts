import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules, registerComponents } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  return t;
}

test("first guest edit copies the source and its feed without changing the source", async () => {
  const t = await setup();
  const sourceResult = await t.mutation(internal.homepageDemo.refresh, {});
  const sourceBefore = await t.query(api.baby.getByPublicId, { id: sourceResult.publicId });
  if (!sourceBefore) throw new Error("expected source");
  expect(
    await t.query(api.demoBabies.access, {
      babyId: sourceBefore._id,
      visitorId: "visitor-a",
      now: Date.now(),
    }),
  ).toEqual({ kind: "source", canEdit: true, expiresAt: null });

  const sourceFeed = await t.query(api.timeline.listByBaby, {
    babyId: sourceBefore._id,
    paginationOpts: { numItems: 100, cursor: null },
  });
  const first = await t.mutation(api.demoBabies.updateSettings, {
    babyId: sourceBefore._id,
    visitorId: "visitor-a",
    update: { name: "My Practice Baby", theme: "bubblegum" },
  });

  expect(first.created).toBe(true);
  expect(first.publicId).toMatch(/^demo-playground-/);
  expect(first.publicId).not.toContain("my-practice-baby");

  const sourceAfter = await t.query(api.baby.getByPublicId, { id: sourceResult.publicId });
  expect(sourceAfter).toMatchObject({
    _id: sourceBefore._id,
    name: sourceBefore.name,
    theme: sourceBefore.theme,
  });

  const playground = await t.query(api.baby.getByPublicId, { id: first.publicId });
  expect(playground).toMatchObject({
    _id: first.babyId,
    name: "My Practice Baby",
    theme: "bubblegum",
    demo: {
      kind: "playground",
      sourceBabyId: sourceBefore._id,
    },
  });
  expect(playground?.demo).not.toHaveProperty("visitorId");

  const playgroundFeed = await t.query(api.timeline.listByBaby, {
    babyId: first.babyId,
    paginationOpts: { numItems: 100, cursor: null },
  });
  expect(playgroundFeed.page).toHaveLength(sourceFeed.page.length);
  expect(playgroundFeed.page.map((item) => item.kind)).toEqual(
    sourceFeed.page.map((item) => item.kind),
  );
});

test("the same visitor reuses one playground and another visitor is refused", async () => {
  const t = await setup();
  const sourceResult = await t.mutation(internal.homepageDemo.refresh, {});
  const source = await t.query(api.baby.getByPublicId, { id: sourceResult.publicId });
  if (!source) throw new Error("expected source");

  const first = await t.mutation(api.demoBabies.updateSettings, {
    babyId: source._id,
    visitorId: "visitor-a",
    update: { theme: "bubblegum" },
  });
  const second = await t.mutation(api.demoBabies.updateSettings, {
    babyId: source._id,
    visitorId: "visitor-a",
    update: { encouragementsDisabled: true },
  });

  expect(second.created).toBe(false);
  expect(second.babyId).toBe(first.babyId);
  await expect(
    t.mutation(api.demoBabies.updateSettings, {
      babyId: first.babyId,
      visitorId: "visitor-b",
      update: { name: "Not yours" },
    }),
  ).rejects.toThrow(/Not authorized/);

  expect(
    await t.query(api.demoBabies.access, {
      babyId: first.babyId,
      visitorId: "visitor-a",
      now: Date.now(),
    }),
  ).toMatchObject({ kind: "playground", canEdit: true });
  expect(
    await t.query(api.demoBabies.access, {
      babyId: first.babyId,
      visitorId: "visitor-b",
      now: Date.now(),
    }),
  ).toMatchObject({ kind: "playground", canEdit: false });
});

test("expired playground cleanup removes the baby and all copied records", async () => {
  const t = await setup();
  const sourceResult = await t.mutation(internal.homepageDemo.refresh, {});
  const source = await t.query(api.baby.getByPublicId, { id: sourceResult.publicId });
  if (!source) throw new Error("expected source");

  const playground = await t.mutation(api.demoBabies.updateSettings, {
    babyId: source._id,
    visitorId: "visitor-a",
    update: { name: "Temporary" },
  });
  await t.run(async (ctx) => {
    const baby = await ctx.db.get(playground.babyId);
    if (!baby || typeof baby.demo !== "object" || baby.demo.kind !== "playground") {
      throw new Error("expected playground");
    }
    await ctx.db.patch(baby._id, {
      demo: { ...baby.demo, expiresAt: Date.now() - 1 },
    });
    await ctx.db.insert("pushSubscriptions", {
      babyId: baby._id,
      endpoint: "https://example.com/push",
      p256dh: "key",
      auth: "secret",
      createdAt: Date.now(),
    });
  });

  await t.mutation(internal.demoBabies.deletePlayground, {
    babyId: playground.babyId,
  });

  expect(await t.run(async (ctx) => await ctx.db.get(playground.babyId))).toBeNull();
  const relatedCounts = await t.run(async (ctx) => {
    const timelineItems = await ctx.db
      .query("timelineItems")
      .withIndex("by_babyId_postedAt", (q) => q.eq("babyId", playground.babyId))
      .collect();
    const updates = await ctx.db
      .query("updates")
      .withIndex("by_babyId", (q) => q.eq("babyId", playground.babyId))
      .collect();
    const encouragements = await ctx.db
      .query("encouragements")
      .withIndex("by_babyId", (q) => q.eq("babyId", playground.babyId))
      .collect();
    const subscriptions = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_babyId", (q) => q.eq("babyId", playground.babyId))
      .collect();
    return {
      timelineItems: timelineItems.length,
      updates: updates.length,
      encouragements: encouragements.length,
      subscriptions: subscriptions.length,
    };
  });
  expect(relatedCounts).toEqual({
    timelineItems: 0,
    updates: 0,
    encouragements: 0,
    subscriptions: 0,
  });
  expect(await t.run(async (ctx) => await ctx.db.get(source._id))).not.toBeNull();
});
