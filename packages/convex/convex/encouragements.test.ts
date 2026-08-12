import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
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
