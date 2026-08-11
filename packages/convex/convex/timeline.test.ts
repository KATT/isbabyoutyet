import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  backfillBabyTimelineDoc,
  backfillEncouragementTimelineDoc,
  clearLegacyStageMessagesDoc,
} from "./migrations";
import schema from "./schema";
import { makeResource } from "./test.resource";
import { modules, registerComponents } from "./test.setup";

const FIRST_PAGE = { numItems: 20, cursor: null };

async function setup() {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby Smith",
    dueDate: "2026-09-01",
  });
  return { t, asAlice, babyId: created.babyId };
}

function useFakeTimersResource() {
  vi.useFakeTimers();
  return makeResource({}, () => {
    vi.useRealTimers();
  });
}

async function getBaby(t: Awaited<ReturnType<typeof setup>>["t"], babyId: Id<"baby">) {
  return await t.run(async (ctx) => {
    const baby = await ctx.db.get(babyId);
    if (!baby) throw new Error("Baby not found");
    return baby;
  });
}

async function storeBlob(t: Awaited<ReturnType<typeof setup>>["t"]) {
  return await t.run(async (ctx) => {
    return await ctx.storage.store(new Blob(["fake image bytes"], { type: "image/jpeg" }));
  });
}

test("a text-only update tops the feed without changing the status", async () => {
  const { t, asAlice, babyId } = await setup();

  await t.mutation(api.encouragements.create, {
    babyId,
    authorName: "Grandma",
    message: "Good luck!",
    visitorId: "visitor-1",
  });

  await asAlice.mutation(api.updates.post, {
    babyId,
    message: "Long walk today — still comfy in there",
  });

  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([
    { kind: "update", update: { message: "Long walk today — still comfy in there" } },
    { kind: "encouragement", encouragement: { authorName: "Grandma" } },
  ]);

  const latest = await t.query(api.timeline.latestUpdate, { babyId });
  expect(latest).toMatchObject({
    update: { message: "Long walk today — still comfy in there" },
  });

  // Status untouched: no milestone was marked and no notification scheduled
  const baby = await getBaby(t, babyId);
  expect(baby).toMatchObject({ laborStarted: null, wentToHospital: null, babyBorn: null });
  const notifications = await asAlice.query(api.baby.getScheduledNotifications, { babyId });
  expect(notifications).toEqual([]);
});

test("posting requires content and ownership", async () => {
  const { t, asAlice, babyId } = await setup();

  await expect(asAlice.mutation(api.updates.post, { babyId, message: "   " })).rejects.toThrow(
    "An update needs a message, a photo, or a milestone",
  );

  const asBob = t.withIdentity({ subject: "bob" });
  await expect(asBob.mutation(api.updates.post, { babyId, message: "Hi" })).rejects.toThrow(
    "Not authorized",
  );

  await expect(t.mutation(api.updates.post, { babyId, message: "Hi" })).rejects.toThrow(
    "Not authenticated",
  );
});

test("a milestone update sets the canonical status and schedules a push", async () => {
  await using _timers = useFakeTimersResource();
  const { t, asAlice, babyId } = await setup();

  await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "born",
    message: "She's here!",
  });

  const baby = await getBaby(t, babyId);
  expect(baby.babyBorn).toBeTruthy();

  const notifications = await asAlice.query(api.baby.getScheduledNotifications, { babyId });
  expect(notifications).toMatchObject([
    { status: "pending", notificationType: "born", customMessage: "She's here!" },
  ]);

  // The same milestone can't be marked twice
  await expect(asAlice.mutation(api.updates.post, { babyId, milestone: "born" })).rejects.toThrow(
    "This milestone is already marked",
  );
});

test("baby.update keeps milestone rows in sync: mark, redate, unmark", async () => {
  const { t, asAlice, babyId } = await setup();

  // Mark labour started
  await asAlice.mutation(api.baby.update, {
    babyId,
    laborStarted: "2026-08-20T08:00:00.000Z",
  });

  let feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([
    {
      kind: "update",
      postedAt: Date.parse("2026-08-20T08:00:00.000Z"),
      update: { milestone: "labor_started" },
    },
  ]);

  // Redate moves the timeline row
  await asAlice.mutation(api.baby.update, {
    babyId,
    laborStarted: "2026-08-20T10:30:00.000Z",
  });
  feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([{ postedAt: Date.parse("2026-08-20T10:30:00.000Z") }]);

  // Unmarking removes the milestone from the feed
  await asAlice.mutation(api.baby.update, { babyId, laborStarted: null });
  feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toEqual([]);
});

test("encouragements dual-write timeline rows and cascade on delete", async () => {
  const { t, asAlice, babyId } = await setup();

  const encouragementId = await t.mutation(api.encouragements.create, {
    babyId,
    authorName: "Uncle Bob",
    message: "So excited!",
    visitorId: "visitor-2",
  });

  let feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([
    { kind: "encouragement", encouragement: { authorName: "Uncle Bob" } },
  ]);

  await asAlice.mutation(api.encouragements.remove, { encouragementId });

  feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toEqual([]);
  const orphanedTimelineItems = await t.run(async (ctx) => {
    return await ctx.db.query("timelineItems").collect();
  });
  expect(orphanedTimelineItems).toEqual([]);
});

test("removing a milestone update unmarks it and cancels the pending push", async () => {
  await using _timers = useFakeTimersResource();
  const { t, asAlice, babyId } = await setup();

  const updateId = await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "labor_started",
    message: "It's starting",
  });

  await asAlice.mutation(api.updates.remove, { updateId });

  const baby = await getBaby(t, babyId);
  expect(baby.laborStarted).toBeNull();

  const notifications = await asAlice.query(api.baby.getScheduledNotifications, { babyId });
  expect(notifications).toMatchObject([{ status: "cancelled", notificationType: "labor_started" }]);

  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toEqual([]);
});

test("photo updates keep old photos; removing one falls back to the previous", async () => {
  const { t, asAlice, babyId } = await setup();

  const photoA = await storeBlob(t);
  const photoB = await storeBlob(t);

  // Legacy path: settings photo uploader
  await asAlice.mutation(api.baby.updatePhoto, { babyId, photoId: photoA });
  // New path: photo posted as an update with a message
  const updateB = await asAlice.mutation(api.updates.post, {
    babyId,
    photoId: photoB,
    message: "Bump week 39",
  });

  let baby = await getBaby(t, babyId);
  expect(baby.photoId).toBe(photoB);

  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([
    { kind: "update", update: { photoId: photoB, message: "Bump week 39" } },
    { kind: "update", update: { photoId: photoA } },
  ]);
  // The old photo stays fully resolvable in the feed
  expect(feed.page[1]?.kind === "update" && feed.page[1].update.photoUrl).toBeTruthy();

  // Removing the newest photo update falls back to the previous photo
  await asAlice.mutation(api.updates.remove, { updateId: updateB });
  baby = await getBaby(t, babyId);
  expect(baby.photoId).toBe(photoA);
});

test("backfill migrations preserve historical order and are idempotent", async () => {
  const { t, babyId, asAlice } = await setup();
  const thumbnail = await storeBlob(t);
  const photo = await storeBlob(t);

  // Shape legacy data directly: milestones + messages + photo, and
  // encouragements without timeline pointers (as they exist pre-migration)
  // Historical dates strictly in the past, so the photo row (backfilled at
  // "now") is the newest item
  const laborStartedAt = new Date(Date.now() - 26 * 60 * 60 * 1000);
  const grandmaAt = new Date(Date.now() - 22 * 60 * 60 * 1000);
  const wentToHospitalAt = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const auntMegAt = new Date(Date.now() - 30 * 60 * 60 * 1000);

  await t.run(async (ctx) => {
    await ctx.db.patch(babyId, {
      laborStarted: laborStartedAt.toISOString(),
      laborStartedMessage: "It has begun!",
      wentToHospital: wentToHospitalAt.toISOString(),
      hospitalMessage: null,
      photoId: photo,
      thumbnailId: thumbnail,
    });
    // timelineItemId is required by now (PR 1's backfill linked all rows)
    const grandmaTimelineItemId = await ctx.db.insert("timelineItems", {
      babyId,
      kind: "encouragement",
      postedAt: grandmaAt.getTime(),
    });
    await ctx.db.insert("encouragements", {
      babyId,
      authorName: "Grandma",
      message: "Waiting by the phone!",
      createdAt: grandmaAt.getTime(),
      timelineItemId: grandmaTimelineItemId,
      visitorId: "visitor-legacy-1",
    });
    const auntMegTimelineItemId = await ctx.db.insert("timelineItems", {
      babyId,
      kind: "encouragement",
      postedAt: auntMegAt.getTime(),
    });
    await ctx.db.insert("encouragements", {
      babyId,
      authorName: "Aunt Meg",
      message: "Thinking of you!",
      createdAt: auntMegAt.getTime(),
      timelineItemId: auntMegTimelineItemId,
      visitorId: "visitor-legacy-2",
    });
  });

  const runBackfills = async () => {
    await t.run(async (ctx) => {
      const baby = await ctx.db.get(babyId);
      if (!baby) throw new Error("Baby not found");
      await backfillBabyTimelineDoc(ctx, baby);
      const encouragements: Doc<"encouragements">[] = await ctx.db
        .query("encouragements")
        .collect();
      for (const encouragement of encouragements) {
        await backfillEncouragementTimelineDoc(ctx, encouragement);
      }
    });
  };

  await runBackfills();
  // Second run must be a no-op
  await runBackfills();

  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([
    // Photo backfills at "now" (no original upload date exists), so it's newest
    { kind: "update", update: { photoId: photo, thumbnailId: thumbnail } },
    { kind: "update", update: { milestone: "gone_to_hospital" } },
    { kind: "encouragement", encouragement: { authorName: "Grandma" } },
    { kind: "update", update: { milestone: "labor_started", message: "It has begun!" } },
    { kind: "encouragement", encouragement: { authorName: "Aunt Meg" } },
  ]);

  // Clearing the legacy stage messages keeps the feed content intact
  await t.run(async (ctx) => {
    const baby = await ctx.db.get(babyId);
    if (!baby) throw new Error("Baby not found");
    await clearLegacyStageMessagesDoc(ctx, baby);
  });
  const clearedBaby = await getBaby(t, babyId);
  expect(clearedBaby).toMatchObject({
    laborStartedMessage: null,
    hospitalMessage: null,
    babyBornMessage: null,
  });
  const feedAfterClear = await t.query(api.timeline.listByBaby, {
    babyId,
    paginationOpts: FIRST_PAGE,
  });
  expect(feedAfterClear.page).toMatchObject([
    { kind: "update" },
    { kind: "update" },
    { kind: "encouragement" },
    { kind: "update", update: { milestone: "labor_started", message: "It has begun!" } },
    { kind: "encouragement" },
  ]);

  // Dual-writes stay consistent post-backfill: unmarking removes the
  // backfilled milestone row too
  await asAlice.mutation(api.baby.update, { babyId, wentToHospital: null });
  const after = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(after.page).toHaveLength(4);
});
