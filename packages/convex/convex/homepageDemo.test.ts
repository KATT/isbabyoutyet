import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules, registerComponents } from "./test.setup";
import { getCurrentStatus } from "../src/types";
import { HOMEPAGE_DEMO_BABY } from "../src/seedCredentials";
import { HOMEPAGE_DEMO_FEED, HOMEPAGE_DEMO_PHOTO_KEYS } from "../src/homepageDemoFeed";

const FIRST_PAGE = { numItems: 50, cursor: null };

const FIXTURE_UPDATES = HOMEPAGE_DEMO_FEED.filter((item) => item.kind === "update");
const FIXTURE_ENCOURAGEMENTS = HOMEPAGE_DEMO_FEED.filter((item) => item.kind === "encouragement");

async function setup() {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  return t;
}

async function storeBlob(t: Awaited<ReturnType<typeof setup>>, bytes: string) {
  return await t.run(async (ctx) => {
    return await ctx.storage.store(new Blob([bytes], { type: "image/jpeg" }));
  });
}

test("refresh creates Juniper Hale as born after a two-day labour with fixture encouragements", async () => {
  const t = await setup();

  const result = await t.mutation(internal.homepageDemo.refresh, {});
  expect(result.publicId).toBe(HOMEPAGE_DEMO_BABY.publicId);

  const baby = await t.query(api.baby.getByPublicId, { id: HOMEPAGE_DEMO_BABY.publicId });
  expect(baby).toMatchObject({
    name: HOMEPAGE_DEMO_BABY.name,
    publicId: HOMEPAGE_DEMO_BABY.publicId,
    userId: HOMEPAGE_DEMO_BABY.ownerUserId,
    theme: HOMEPAGE_DEMO_BABY.theme,
  });
  expect(getCurrentStatus(baby!)).toMatchObject({ type: "born" });

  const now = Date.now();
  const laborStartedAt = Date.parse(baby!.laborStarted!);
  const bornAt = Date.parse(baby!.babyBorn!);
  expect(now - laborStartedAt).toBeGreaterThan(40 * 60 * 60_000);
  expect(now - laborStartedAt).toBeLessThan(42 * 60 * 60_000);
  expect(now - bornAt).toBeGreaterThan(2 * 60 * 60_000);
  expect(now - bornAt).toBeLessThan(3 * 60 * 60_000);

  const feed = await t.query(api.timeline.listByBaby, {
    babyId: baby!._id,
    paginationOpts: FIRST_PAGE,
  });
  expect(feed.page).toHaveLength(HOMEPAGE_DEMO_FEED.length);
  expect(feed.page[0]?.kind).toBe("encouragement");
  expect(feed.page[0]?.kind === "encouragement" && feed.page[0].encouragement.authorName).toBe(
    "Jess",
  );

  const updates = feed.page.filter((item) => item.kind === "update");
  const encouragements = feed.page.filter((item) => item.kind === "encouragement");
  expect(updates).toHaveLength(FIXTURE_UPDATES.length);
  expect(encouragements).toHaveLength(FIXTURE_ENCOURAGEMENTS.length);
  expect(updates.map((item) => item.kind === "update" && item.update.milestone)).toEqual(
    expect.arrayContaining(["labor_started", "gone_to_hospital", "born"]),
  );
});

test("refresh is idempotent and wipes visitor encouragements", async () => {
  const t = await setup();

  const first = await t.mutation(internal.homepageDemo.refresh, {});
  await t.mutation(api.encouragements.create, {
    babyId: first.babyId,
    authorName: "Random Visitor",
    message: "Congrats from the internet!",
    visitorId: "visitor-spam",
  });

  const before = await t.query(api.timeline.listByBaby, {
    babyId: first.babyId,
    paginationOpts: FIRST_PAGE,
  });
  expect(before.page).toHaveLength(HOMEPAGE_DEMO_FEED.length + 1);

  const second = await t.mutation(internal.homepageDemo.refresh, {});
  expect(second.babyId).toBe(first.babyId);

  const babies = await t.run(async (ctx) => {
    return await ctx.db
      .query("baby")
      .withIndex("by_publicId", (q) => q.eq("publicId", HOMEPAGE_DEMO_BABY.publicId))
      .collect();
  });
  expect(babies).toHaveLength(1);

  const after = await t.query(api.timeline.listByBaby, {
    babyId: second.babyId,
    paginationOpts: FIRST_PAGE,
  });
  expect(after.page).toHaveLength(HOMEPAGE_DEMO_FEED.length);
  expect(
    after.page.some(
      (item) => item.kind === "encouragement" && item.encouragement.authorName === "Random Visitor",
    ),
  ).toBe(false);
});

test("refresh attaches photos to the matching updates and pins the newborn as the page photo", async () => {
  const t = await setup();

  const photos: Record<string, { photoId: Id<"_storage">; thumbnailId: Id<"_storage"> }> = {};
  for (const key of HOMEPAGE_DEMO_PHOTO_KEYS) {
    photos[key] = {
      photoId: await storeBlob(t, `${key}-photo`),
      thumbnailId: await storeBlob(t, `${key}-thumb`),
    };
  }

  const result = await t.mutation(internal.homepageDemo.refresh, { photos });
  const baby = await t.query(api.baby.getByPublicId, { id: result.publicId });
  expect(baby?.photoUrl).toBeTruthy();
  expect(baby?.photoId).toBe(photos.born?.photoId);

  const feed = await t.query(api.timeline.listByBaby, {
    babyId: result.babyId,
    paginationOpts: FIRST_PAGE,
  });
  const photoUpdates = feed.page.filter((item) => item.kind === "update" && item.update.photoUrl);
  expect(photoUpdates).toHaveLength(HOMEPAGE_DEMO_PHOTO_KEYS.length);

  const bornUpdate = feed.page.find(
    (item) => item.kind === "update" && item.update.milestone === "born",
  );
  expect(bornUpdate?.kind === "update" && bornUpdate.update.isCurrentPagePhoto).toBe(true);
});

test("generateUploadUrl returns a storage upload URL", async () => {
  const t = await setup();
  const url = await t.mutation(internal.homepageDemo.generateUploadUrl, {});
  expect(url).toEqual(expect.any(String));
  expect(url.length).toBeGreaterThan(0);
});

test("clearFeedBatch reports hasMore until the feed is empty", async () => {
  const t = await setup();
  const { babyId } = await t.mutation(internal.homepageDemo.refresh, {});

  let batches = 0;
  let hasMore = true;
  while (hasMore) {
    const result = await t.mutation(internal.homepageDemo.clearFeedBatch, { babyId });
    batches += 1;
    hasMore = result.hasMore;
    expect(result.deleted).toBeGreaterThan(0);
    expect(batches).toBeLessThan(10);
  }

  const feed = await t.query(api.timeline.listByBaby, {
    babyId,
    paginationOpts: FIRST_PAGE,
  });
  expect(feed.page).toHaveLength(0);
});
