import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { makeResource } from "./test.resource";
import { modules, registerComponents } from "./test.setup";

const FIRST_PAGE = { numItems: 10, cursor: null };

async function setupWithBaby() {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const babyId: Id<"baby"> = await t.run(async (ctx) => {
    return await ctx.db.insert("baby", {
      userId: "alice",
      name: "Baby Smith",
      dueDate: "2026-09-01",
      publicId: "baby-smith",
    });
  });
  return { t, babyId };
}

test("visitors can create encouragements and list them", async () => {
  const { t, babyId } = await setupWithBaby();

  await t.mutation(api.encouragements.create, {
    babyId,
    authorName: "Grandma",
    message: "We can't wait to meet you!",
    visitorId: "visitor-1",
  });
  await t.mutation(api.encouragements.create, {
    babyId,
    authorName: "  Uncle Bob  ",
    message: "Good luck! ",
    visitorId: "visitor-2",
  });

  const result = await t.query(api.encouragements.listByBaby, {
    babyId,
    paginationOpts: FIRST_PAGE,
  });

  // Newest first; names and messages are trimmed
  expect(result.page).toMatchObject([
    { authorName: "Uncle Bob", message: "Good luck!", visitorId: "visitor-2" },
    { authorName: "Grandma", message: "We can't wait to meet you!", visitorId: "visitor-1" },
  ]);
});

test("the author can edit their encouragement within the edit window", async () => {
  const { t, babyId } = await setupWithBaby();

  const encouragementId = await t.mutation(api.encouragements.create, {
    babyId,
    authorName: "Grandma",
    message: "Typo mesage",
    visitorId: "visitor-1",
  });

  await t.mutation(api.encouragements.update, {
    encouragementId,
    visitorId: "visitor-1",
    message: "Fixed message",
  });

  const result = await t.query(api.encouragements.listByBaby, {
    babyId,
    paginationOpts: FIRST_PAGE,
  });
  expect(result.page).toMatchObject([{ message: "Fixed message" }]);
});

test("create validates the baby, the author name and the message", async () => {
  const { t, babyId } = await setupWithBaby();

  await expect(
    t.mutation(api.encouragements.create, {
      babyId,
      authorName: "   ",
      message: "Hello",
      visitorId: "v",
    }),
  ).rejects.toThrow("Name is required");

  await expect(
    t.mutation(api.encouragements.create, {
      babyId,
      authorName: "x".repeat(51),
      message: "Hello",
      visitorId: "v",
    }),
  ).rejects.toThrow("Name must be 50 characters or less");

  await expect(
    t.mutation(api.encouragements.create, {
      babyId,
      authorName: "Grandma",
      message: "   ",
      visitorId: "v",
    }),
  ).rejects.toThrow("Message is required");

  const missingBabyId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("baby", {
      userId: "x",
      name: "Temp",
      dueDate: "2026-09-01",
      publicId: "temp",
    });
    await ctx.db.delete(id);
    return id;
  });
  await expect(
    t.mutation(api.encouragements.create, {
      babyId: missingBabyId,
      authorName: "Grandma",
      message: "Hello",
      visitorId: "v",
    }),
  ).rejects.toThrow("Baby not found");
});

test("create is rejected when encouragements are disabled", async () => {
  const { t, babyId } = await setupWithBaby();

  await t.run(async (ctx) => {
    await ctx.db.patch(babyId, { encouragementsDisabled: true });
  });

  await expect(
    t.mutation(api.encouragements.create, {
      babyId,
      authorName: "Grandma",
      message: "Hello",
      visitorId: "v",
    }),
  ).rejects.toThrow("Encouragements are disabled for this baby");
});

test("update rejects other visitors, empty messages and edits after the window", async () => {
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });
  vi.useFakeTimers({ now: new Date("2026-08-11T12:00:00.000Z") });

  const { t, babyId } = await setupWithBaby();
  const encouragementId = await t.mutation(api.encouragements.create, {
    babyId,
    authorName: "Grandma",
    message: "Original",
    visitorId: "visitor-1",
  });

  await expect(
    t.mutation(api.encouragements.update, {
      encouragementId,
      visitorId: "visitor-2",
      message: "Hijacked",
    }),
  ).rejects.toThrow("Not authorized to edit this encouragement");

  await expect(
    t.mutation(api.encouragements.update, {
      encouragementId,
      visitorId: "visitor-1",
      message: "   ",
    }),
  ).rejects.toThrow("Message is required");

  const missingId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("encouragements", {
      babyId,
      authorName: "Ghost",
      message: "Gone",
      createdAt: Date.now(),
      visitorId: "visitor-9",
    });
    await ctx.db.delete(id);
    return id;
  });
  await expect(
    t.mutation(api.encouragements.update, {
      encouragementId: missingId,
      visitorId: "visitor-9",
      message: "Hello",
    }),
  ).rejects.toThrow("Encouragement not found");

  // 16 minutes later the edit window has closed
  vi.advanceTimersByTime(16 * 60 * 1000);
  await expect(
    t.mutation(api.encouragements.update, {
      encouragementId,
      visitorId: "visitor-1",
      message: "Too late",
    }),
  ).rejects.toThrow("Edit window has expired (15 minutes)");
});

test("visitors can remove their own recent encouragement, others cannot", async () => {
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });
  vi.useFakeTimers({ now: new Date("2026-08-11T12:00:00.000Z") });

  const { t, babyId } = await setupWithBaby();
  const encouragementId = await t.mutation(api.encouragements.create, {
    babyId,
    authorName: "Grandma",
    message: "Oops wrong baby",
    visitorId: "visitor-1",
  });

  await expect(
    t.mutation(api.encouragements.remove, { encouragementId, visitorId: "visitor-2" }),
  ).rejects.toThrow("Not authorized to delete this encouragement");

  await t.mutation(api.encouragements.remove, { encouragementId, visitorId: "visitor-1" });
  const result = await t.query(api.encouragements.listByBaby, {
    babyId,
    paginationOpts: FIRST_PAGE,
  });
  expect(result.page).toEqual([]);

  await expect(
    t.mutation(api.encouragements.remove, { encouragementId, visitorId: "visitor-1" }),
  ).rejects.toThrow("Encouragement not found");

  // After the edit window even the author can no longer self-delete
  const lateId = await t.mutation(api.encouragements.create, {
    babyId,
    authorName: "Grandma",
    message: "Old post",
    visitorId: "visitor-1",
  });
  vi.advanceTimersByTime(16 * 60 * 1000);
  await expect(
    t.mutation(api.encouragements.remove, { encouragementId: lateId, visitorId: "visitor-1" }),
  ).rejects.toThrow("Not authorized to delete this encouragement");
});

test("remove fails when the baby record is gone", async () => {
  const { t, babyId } = await setupWithBaby();
  const encouragementId = await t.mutation(api.encouragements.create, {
    babyId,
    authorName: "Grandma",
    message: "Hello",
    visitorId: "visitor-1",
  });

  await t.run(async (ctx) => {
    await ctx.db.delete(babyId);
  });

  await expect(
    t.mutation(api.encouragements.remove, { encouragementId, visitorId: "visitor-1" }),
  ).rejects.toThrow("Baby not found");
});

test("the baby's owner can remove an encouragement", async () => {
  const { t, babyId } = await setupWithBaby();

  const encouragementId = await t.mutation(api.encouragements.create, {
    babyId,
    authorName: "Stranger",
    message: "Something inappropriate",
    visitorId: "visitor-x",
  });

  const asOwner = t.withIdentity({ subject: "alice" });
  await asOwner.mutation(api.encouragements.remove, { encouragementId });

  const result = await t.query(api.encouragements.listByBaby, {
    babyId,
    paginationOpts: FIRST_PAGE,
  });
  expect(result.page).toEqual([]);
});
