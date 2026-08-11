import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { backfillBabyTimelineDoc, backfillEncouragementTimelineDoc } from "./migrations";
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

test("the public feed never leaks visitor credentials or metadata", async () => {
  const { t, babyId } = await setup();

  await t.mutation(api.encouragements.create, {
    babyId,
    authorName: "Grandma",
    message: "Hi!",
    visitorId: "visitor-secret",
    userAgent: "Mozilla/5.0",
    locale: "en-US",
    timezone: "Europe/Stockholm",
  });

  const anonymous = await t.query(api.timeline.listByBaby, {
    babyId,
    paginationOpts: FIRST_PAGE,
  });
  const item = anonymous.page[0];
  if (item?.kind !== "encouragement") throw new Error("expected encouragement item");
  expect(item.encouragement).not.toHaveProperty("visitorId");
  expect(item.encouragement).not.toHaveProperty("userAgent");
  expect(item.encouragement).not.toHaveProperty("locale");
  expect(item.encouragement).not.toHaveProperty("timezone");
  expect(item.encouragement.isMine).toBe(false);

  // The author sees their own post marked as theirs
  const asAuthor = await t.query(api.timeline.listByBaby, {
    babyId,
    visitorId: "visitor-secret",
    paginationOpts: FIRST_PAGE,
  });
  const ownItem = asAuthor.page[0];
  if (ownItem?.kind !== "encouragement") throw new Error("expected encouragement item");
  expect(ownItem.encouragement.isMine).toBe(true);
});

test("a photo-only update does not blank the latest message", async () => {
  const { t, asAlice, babyId } = await setup();
  const photo = await storeBlob(t);

  await asAlice.mutation(api.updates.post, { babyId, message: "Still waiting!" });
  await asAlice.mutation(api.updates.post, { babyId, photoId: photo });

  const latest = await t.query(api.timeline.latestUpdate, { babyId });
  expect(latest).toMatchObject({ update: { message: "Still waiting!" } });
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

test("baby.update keeps milestone rows in sync: mark, redate, edit message, unmark", async () => {
  const { t, asAlice, babyId } = await setup();

  // Mark labour started with a stage message
  await asAlice.mutation(api.baby.update, {
    babyId,
    laborStarted: "2026-08-20T08:00:00.000Z",
    laborStartedMessage: "It has begun!",
  });

  let feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([
    {
      kind: "update",
      postedAt: Date.parse("2026-08-20T08:00:00.000Z"),
      update: { milestone: "labor_started", message: "It has begun!" },
    },
  ]);

  // Redate moves the timeline row
  await asAlice.mutation(api.baby.update, {
    babyId,
    laborStarted: "2026-08-20T10:30:00.000Z",
  });
  feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([{ postedAt: Date.parse("2026-08-20T10:30:00.000Z") }]);

  // Editing the stage message keeps the row in sync
  await asAlice.mutation(api.baby.update, {
    babyId,
    laborStartedMessage: "Contractions every 5 minutes",
  });
  feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([{ update: { message: "Contractions every 5 minutes" } }]);

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
    { kind: "update", update: { message: "Bump week 39" } },
    { kind: "update", update: { message: null } },
  ]);
  // Both photos (including the replaced one) stay fully resolvable in the feed
  expect(feed.page[0]?.kind === "update" && feed.page[0].update.photoUrl).toBeTruthy();
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
    await ctx.db.insert("encouragements", {
      babyId,
      authorName: "Grandma",
      message: "Waiting by the phone!",
      createdAt: grandmaAt.getTime(),
      visitorId: "visitor-legacy-1",
    });
    await ctx.db.insert("encouragements", {
      babyId,
      authorName: "Aunt Meg",
      message: "Thinking of you!",
      createdAt: auntMegAt.getTime(),
      visitorId: "visitor-legacy-2",
    });
  });

  // Simulate the deploy window where dual-writes go live BEFORE the backfill
  // runs: one milestone row already exists; the backfill must still fill in
  // the other milestone and the photo (per-item idempotency, not per-baby)
  await asAlice.mutation(api.baby.update, {
    babyId,
    wentToHospital: wentToHospitalAt.toISOString(),
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
    // The photo backfills at its storage file's upload time (just now in this
    // test), so it sorts newest here
    { kind: "update", update: { milestone: null, message: null } },
    { kind: "update", update: { milestone: "gone_to_hospital" } },
    { kind: "encouragement", encouragement: { authorName: "Grandma" } },
    { kind: "update", update: { milestone: "labor_started", message: "It has begun!" } },
    { kind: "encouragement", encouragement: { authorName: "Aunt Meg" } },
  ]);
  expect(feed.page[0]?.kind === "update" && feed.page[0].update.photoUrl).toBeTruthy();
  expect(feed.page[0]?.kind === "update" && feed.page[0].update.thumbnailUrl).toBeTruthy();

  // The photo row's postedAt is the storage file's original upload time
  const photoUploadedAt = await t.run(async (ctx) => {
    const fileMetadata = await ctx.db.system.get(photo);
    return fileMetadata?._creationTime;
  });
  expect(photoUploadedAt).toBeTruthy();
  expect(feed.page[0]?.postedAt).toBe(photoUploadedAt);

  // Dual-writes stay consistent post-backfill: unmarking removes the
  // backfilled milestone row too
  await asAlice.mutation(api.baby.update, { babyId, wentToHospital: null });
  const after = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(after.page).toHaveLength(4);
});
