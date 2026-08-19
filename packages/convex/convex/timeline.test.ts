import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  backfillBabyTimelineDoc,
  backfillEncouragementTimelineDoc,
  clearLegacyStageMessagesDoc,
  separateMilestoneOccurredAtDoc,
} from "./migrations";
import schema from "./schema";
import { makeResource } from "./test.resource";
import { modules, registerComponents } from "./test.setup";
import { insertUpdateWithTimelineItem } from "./timeline";

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
  await using _timers = useFakeTimersResource();
  const { t, asAlice, babyId } = await setup();

  await t.mutation(api.encouragements.create, {
    babyId,
    authorName: "Grandma",
    message: "Good luck!",
    visitorId: "visitor-1",
  });

  await asAlice.mutation(api.updates.post, {
    babyId,
    message: "Long walk today. Still comfy in there",
  });

  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([
    { kind: "update", update: { message: "Long walk today. Still comfy in there" } },
    { kind: "encouragement", encouragement: { authorName: "Grandma" } },
  ]);

  const latest = await t.query(api.timeline.latestUpdate, { babyId });
  expect(latest).toMatchObject({
    update: { message: "Long walk today. Still comfy in there" },
  });

  // Status stays untouched, but every owner update schedules a push.
  const publicBaby = await t.query(api.baby.getByPublicId, { id: babyId });
  expect(publicBaby).toMatchObject({ laborStarted: null, wentToHospital: null, babyBorn: null });
  const baby = await getBaby(t, babyId);
  expect(baby.lastActivityAt).toBe(feed.page[0]?.postedAt);
  const notifications = await asAlice.query(api.baby.getScheduledNotifications, { babyId });
  expect(notifications).toMatchObject([
    {
      status: "pending",
      notificationType: "update_posted",
      customMessage: "Long walk today. Still comfy in there",
      photoId: null,
    },
  ]);
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
  await using _timers = useFakeTimersResource();
  const { t, asAlice, babyId } = await setup();
  const photo = await storeBlob(t);

  await asAlice.mutation(api.updates.post, { babyId, message: "Still waiting!" });
  await asAlice.mutation(api.updates.post, { babyId, photoId: photo });

  const latest = await t.query(api.timeline.latestUpdate, { babyId });
  expect(latest).toMatchObject({ update: { message: "Still waiting!" } });

  const notifications = await asAlice.query(api.baby.getScheduledNotifications, { babyId });
  expect(notifications).toMatchObject([
    { status: "pending", notificationType: "photo_added", customMessage: null, photoId: photo },
    {
      status: "pending",
      notificationType: "update_posted",
      customMessage: "Still waiting!",
      photoId: null,
    },
  ]);
});

test("posting requires content and ownership", async () => {
  const { t, asAlice, babyId } = await setup();

  await expect(asAlice.mutation(api.updates.post, { babyId, message: "   " })).rejects.toThrow(
    "An update needs a message, a photo, or a milestone",
  );

  // The three fields are mutually inclusive — any single one is enough, and
  // a whitespace-only message is trimmed away rather than blocking the post
  const photo = await storeBlob(t);
  await asAlice.mutation(api.updates.post, { babyId, message: "   ", photoId: photo });
  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page[0]).toMatchObject({ kind: "update", update: { message: null } });
  expect(feed.page[0]?.kind === "update" && feed.page[0].update.photoUrl).toBeTruthy();

  const asBob = t.withIdentity({ subject: "bob" });
  await expect(asBob.mutation(api.updates.post, { babyId, message: "Hi" })).rejects.toThrow(
    "Not authorized",
  );

  await expect(t.mutation(api.updates.post, { babyId, message: "Hi" })).rejects.toThrow(
    "Not authenticated",
  );
});

test("status is inferred from milestone updates, not stored baby fields", async () => {
  await using _timers = useFakeTimersResource();
  const { t, asAlice, babyId } = await setup();

  await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "born",
    message: "She's here!",
  });

  const publicBaby = await t.query(api.baby.getByPublicId, { id: babyId });
  expect(publicBaby?.babyBorn).toBeTruthy();
  const stored = await getBaby(t, babyId);
  for (const field of [
    "laborStarted",
    "wentToHospital",
    "babyBorn",
    "laborStartedMessage",
    "hospitalMessage",
    "babyBornMessage",
  ] as const) {
    expect(stored[field]).toBeUndefined();
  }

  const notifications = await asAlice.query(api.baby.getScheduledNotifications, { babyId });
  expect(notifications).toMatchObject([
    { status: "pending", notificationType: "born", customMessage: "She's here!", photoId: null },
  ]);

  // The status only moves forward: re-marking the same milestone — or any
  // earlier stage — is rejected once a later stage is reached
  await expect(asAlice.mutation(api.updates.post, { babyId, milestone: "born" })).rejects.toThrow(
    "Only a future status can be marked",
  );
  await expect(
    asAlice.mutation(api.updates.post, { babyId, milestone: "gone_to_hospital" }),
  ).rejects.toThrow("Only a future status can be marked");
  await expect(
    asAlice.mutation(api.updates.post, { babyId, milestone: "labor_started" }),
  ).rejects.toThrow("Only a future status can be marked");
});

test("stale stored baby dates are ignored when no milestone update exists", async () => {
  const { t, babyId } = await setup();

  await t.run(async (ctx) => {
    await ctx.db.patch(babyId, {
      laborStarted: "2026-08-10T08:00:00.000Z",
      wentToHospital: "2026-08-10T12:00:00.000Z",
      babyBorn: "2026-08-11T03:00:00.000Z",
    });
  });

  const publicBaby = await t.query(api.baby.getByPublicId, { id: babyId });
  expect(publicBaby).toMatchObject({
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
  });
});

test("a legacy milestone without occurredAt infers its date from feed position", async () => {
  const { t, babyId } = await setup();
  const postedAt = Date.parse("2026-08-10T08:00:00.000Z");

  await t.run(async (ctx) => {
    await insertUpdateWithTimelineItem(ctx, {
      babyId,
      postedAt,
      milestone: "labor_started",
    });
  });

  const publicBaby = await t.query(api.baby.getByPublicId, { id: babyId });
  expect(publicBaby?.laborStarted).toBe("2026-08-10T08:00:00.000Z");
});

test("a milestone update without an event clock or feed row does not infer a date", async () => {
  const { t, babyId } = await setup();

  await t.run(async (ctx) => {
    const { timelineItemId } = await insertUpdateWithTimelineItem(ctx, {
      babyId,
      postedAt: Date.parse("2026-08-10T08:00:00.000Z"),
      milestone: "born",
    });
    await ctx.db.delete(timelineItemId);
  });

  const publicBaby = await t.query(api.baby.getByPublicId, { id: babyId });
  expect(publicBaby?.babyBorn).toBeNull();
});

test("an invalid persisted milestone timestamp is ignored", async () => {
  const { t, babyId } = await setup();

  await t.run(async (ctx) => {
    await insertUpdateWithTimelineItem(ctx, {
      babyId,
      postedAt: Date.now(),
      occurredAt: Number.MAX_VALUE,
      milestone: "labor_started",
    });
  });

  const publicBaby = await t.query(api.baby.getByPublicId, { id: babyId });
  expect(publicBaby?.laborStarted).toBeNull();
});

test("journey selection does not block backend milestone writes", async () => {
  const { t, asAlice, babyId } = await setup();
  await asAlice.mutation(api.baby.update, {
    babyId,
    birthJourney: "planned_c_section",
  });

  await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "labor_started",
    occurredAt: Date.parse("2026-08-10T08:00:00.000Z"),
  });

  const baby = await getBaby(t, babyId);
  expect(baby.laborStarted).toBeUndefined();
  expect(baby.birthJourney).toBe("planned_c_section");
  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([{ kind: "update", update: { milestone: "labor_started" } }]);
});

test("changing selection leaves existing updates and notifications untouched", async () => {
  await using _timers = useFakeTimersResource();
  const { t, asAlice, babyId } = await setup();
  const photoId = await storeBlob(t);

  await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "labor_started",
    message: "A quiet update for everyone",
    photoId,
  });

  const notificationsBefore = await asAlice.query(api.baby.getScheduledNotifications, { babyId });
  await asAlice.mutation(api.baby.update, {
    babyId,
    birthJourney: "planned_c_section",
  });

  const feed = await t.query(api.timeline.listByBaby, {
    babyId,
    paginationOpts: FIRST_PAGE,
  });
  expect(feed.page).toHaveLength(1);
  expect(feed.page[0]).toMatchObject({
    kind: "update",
    update: {
      message: "A quiet update for everyone",
      milestone: "labor_started",
    },
  });
  expect(feed.page[0]?.kind === "update" && feed.page[0].update.photoUrl).toBeTruthy();
  const notificationsAfter = await asAlice.query(api.baby.getScheduledNotifications, { babyId });
  expect(notificationsAfter).toEqual(notificationsBefore);
});

test("changing selection then unmarking cancels the pending milestone push", async () => {
  await using _timers = useFakeTimersResource();
  const { asAlice, babyId } = await setup();
  await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "labor_started",
  });

  await asAlice.mutation(api.baby.update, {
    babyId,
    birthJourney: "planned_c_section",
  });
  await asAlice.mutation(api.updates.unmarkMilestone, {
    babyId,
    milestone: "labor_started",
  });

  const notifications = await asAlice.query(api.baby.getScheduledNotifications, { babyId });
  expect(notifications).toMatchObject([{ notificationType: "labor_started", status: "cancelled" }]);
});

test("selection changes do not filter empty historical milestone rows", async () => {
  const { t, asAlice, babyId } = await setup();
  await asAlice.mutation(api.updates.post, { babyId, milestone: "labor_started" });

  await asAlice.mutation(api.baby.update, {
    babyId,
    birthJourney: "planned_c_section",
  });

  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([{ kind: "update", update: { milestone: "labor_started" } }]);
});

test("a milestone with a photo is a single status push that carries the image", async () => {
  await using _timers = useFakeTimersResource();
  const { t, asAlice, babyId } = await setup();
  const photo = await storeBlob(t);

  await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "born",
    message: "She's here!",
    photoId: photo,
  });

  const notifications = await asAlice.query(api.baby.getScheduledNotifications, { babyId });
  expect(notifications).toMatchObject([
    {
      status: "pending",
      notificationType: "born",
      customMessage: "She's here!",
      photoId: photo,
    },
  ]);
});

test("a later generic update does not cancel a pending status push", async () => {
  await using _timers = useFakeTimersResource();
  const { asAlice, babyId } = await setup();

  await asAlice.mutation(api.updates.post, { babyId, milestone: "labor_started" });
  await asAlice.mutation(api.updates.post, { babyId, message: "Breathing through it" });

  const notifications = await asAlice.query(api.baby.getScheduledNotifications, { babyId });
  expect(notifications).toMatchObject([
    {
      status: "pending",
      notificationType: "update_posted",
      customMessage: "Breathing through it",
    },
    { status: "pending", notificationType: "labor_started" },
  ]);
});

test("the forward-only guard enforces order at every intermediate stage", async () => {
  await using _timers = useFakeTimersResource();
  const { asAlice, babyId } = await setup();

  // From labor_started: re-marking it is rejected, later stages are open
  await asAlice.mutation(api.updates.post, { babyId, milestone: "labor_started" });
  await expect(
    asAlice.mutation(api.updates.post, { babyId, milestone: "labor_started" }),
  ).rejects.toThrow("Only a future status can be marked");
  await asAlice.mutation(api.updates.post, { babyId, milestone: "gone_to_hospital" });

  // From gone_to_hospital: same and earlier stages are rejected, born is open
  await expect(
    asAlice.mutation(api.updates.post, { babyId, milestone: "gone_to_hospital" }),
  ).rejects.toThrow("Only a future status can be marked");
  await expect(
    asAlice.mutation(api.updates.post, { babyId, milestone: "labor_started" }),
  ).rejects.toThrow("Only a future status can be marked");
  await asAlice.mutation(api.updates.post, { babyId, milestone: "born" });
});

test("milestones are posted, redated, and unmarked through explicit update operations", async () => {
  const { t, asAlice, babyId } = await setup();

  const initialOccurredAt = Date.parse("2026-08-10T08:00:00.000Z");
  const beforeMark = Date.now();
  await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "labor_started",
    occurredAt: initialOccurredAt,
  });
  const afterMark = Date.now();

  let feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toHaveLength(1);
  const marked = feed.page[0];
  if (marked?.kind !== "update") throw new Error("expected update");
  // Feed position is announce time (now), not the historical event clock
  expect(marked.postedAt).toBeGreaterThanOrEqual(beforeMark);
  expect(marked.postedAt).toBeLessThanOrEqual(afterMark);
  expect(marked.update).toMatchObject({
    milestone: "labor_started",
    occurredAt: initialOccurredAt,
  });

  // Redate updates the event clock only — feed position stays put
  const postedAtBeforeRedate = marked.postedAt;
  await asAlice.mutation(api.updates.redateMilestone, {
    babyId,
    milestone: "labor_started",
    occurredAt: Date.parse("2026-08-10T10:30:00.000Z"),
  });
  feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([
    {
      postedAt: postedAtBeforeRedate,
      update: { occurredAt: Date.parse("2026-08-10T10:30:00.000Z") },
    },
  ]);

  // Unmarking removes the milestone from the feed
  await asAlice.mutation(api.updates.unmarkMilestone, {
    babyId,
    milestone: "labor_started",
  });
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
  const softDeleted = await t.run(async (ctx) => {
    const items = await ctx.db.query("timelineItems").collect();
    const encouragements = await ctx.db.query("encouragements").collect();
    return { items, encouragements };
  });
  expect(softDeleted.items).toHaveLength(1);
  expect(softDeleted.items[0]?.deletedAt).toEqual(expect.any(Number));
  expect(softDeleted.encouragements).toHaveLength(1);
  expect(softDeleted.encouragements[0]?.deletedAt).toEqual(expect.any(Number));
});

test("removing a milestone update unmarks it and cancels the pending push", async () => {
  await using _timers = useFakeTimersResource();
  const { t, asAlice, babyId } = await setup();

  const updateId = await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "labor_started",
    message: "It's starting",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(babyId, { laborStarted: "2026-08-10T08:00:00.000Z" });
  });

  await asAlice.mutation(api.updates.remove, { updateId });
  await t.run(async (ctx) => {
    const baby = await ctx.db.get(babyId);
    if (!baby) throw new Error("Baby not found");
    expect(baby.laborStarted).toBeUndefined();
    await backfillBabyTimelineDoc(ctx, baby);
  });

  const publicBaby = await t.query(api.baby.getByPublicId, { id: babyId });
  expect(publicBaby).toMatchObject({ laborStarted: null, wentToHospital: null, babyBorn: null });

  const notifications = await asAlice.query(api.baby.getScheduledNotifications, { babyId });
  expect(notifications).toMatchObject([{ status: "cancelled", notificationType: "labor_started" }]);

  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toEqual([]);
});

test("milestones must be deleted in reverse order", async () => {
  await using _timers = useFakeTimersResource();
  const { t, asAlice, babyId } = await setup();

  const laborUpdateId = await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "labor_started",
  });
  const hospitalUpdateId = await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "gone_to_hospital",
  });
  const bornUpdateId = await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "born",
  });

  await expect(
    asAlice.mutation(api.updates.unmarkMilestone, {
      babyId,
      milestone: "gone_to_hospital",
    }),
  ).rejects.toThrow("Delete the Born status first");
  await expect(asAlice.mutation(api.updates.remove, { updateId: laborUpdateId })).rejects.toThrow(
    "Delete the Born status first",
  );

  await asAlice.mutation(api.updates.remove, { updateId: bornUpdateId });
  await expect(asAlice.mutation(api.updates.remove, { updateId: laborUpdateId })).rejects.toThrow(
    "Delete the Gone to hospital status first",
  );
  await asAlice.mutation(api.updates.remove, { updateId: hospitalUpdateId });
  await asAlice.mutation(api.updates.remove, { updateId: laborUpdateId });

  const publicBaby = await t.query(api.baby.getByPublicId, { id: babyId });
  expect(publicBaby).toMatchObject({ laborStarted: null, wentToHospital: null, babyBorn: null });
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

test("text updates never displace the current page photo; pinning brings back an older one", async () => {
  const { t, asAlice, babyId } = await setup();
  const photoA = await storeBlob(t);
  const photoB = await storeBlob(t);

  await asAlice.mutation(api.updates.post, { babyId, photoId: photoA, message: "First pic" });
  const updateB = await asAlice.mutation(api.updates.post, { babyId, photoId: photoB });

  // Text-only posts after a photo upload leave the page photo alone
  await asAlice.mutation(api.updates.post, { babyId, message: "Just a status, no new photo" });
  await asAlice.mutation(api.updates.post, { babyId, message: "Another one" });
  let baby = await getBaby(t, babyId);
  expect(baby.photoId).toBe(photoB);

  // The feed marks which photo is the current page photo
  let feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  const photoFlags = feed.page
    .filter((item) => item.kind === "update" && item.update.photoUrl)
    .map((item) => item.kind === "update" && item.update.isCurrentPagePhoto);
  expect(photoFlags).toEqual([true, false]); // newest photo (B) is current, A is not

  // Pin the older photo back as the page photo
  const photoUpdates = feed.page.filter((item) => item.kind === "update" && item.update.photoUrl);
  const updateA = photoUpdates[photoUpdates.length - 1];
  if (updateA?.kind !== "update") throw new Error("expected photo update");
  await asAlice.mutation(api.updates.setAsCurrentPhoto, { updateId: updateA.update._id });
  baby = await getBaby(t, babyId);
  expect(baby.photoId).toBe(photoA);

  // A brand-new photo upload takes over again (latest wins by default)
  const photoC = await storeBlob(t);
  await asAlice.mutation(api.updates.post, { babyId, photoId: photoC });
  baby = await getBaby(t, babyId);
  expect(baby.photoId).toBe(photoC);

  // Only the owner can pin
  const asBob = t.withIdentity({ subject: "bob" });
  await expect(
    asBob.mutation(api.updates.setAsCurrentPhoto, { updateId: updateB }),
  ).rejects.toThrow("Not authorized");
});

test("backfill migrations preserve announce-time order and are idempotent", async () => {
  await using _timers = useFakeTimersResource();
  const { t, babyId, asAlice } = await setup();
  const thumbnail = await storeBlob(t);
  const photo = await storeBlob(t);

  // Shape legacy data: milestones + messages + photo, encouragements without
  // timeline pointers. Milestone event clocks are historical; feed position
  // uses announce time (notification createdAt / now).
  const laborStartedAt = new Date(Date.now() - 26 * 60 * 60 * 1000);
  const laborAnnouncedAt = Date.now() - 24 * 60 * 60 * 1000;
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
    // A sent push records when labour was announced to followers
    await ctx.db.insert("scheduledNotifications", {
      babyId,
      status: "sent",
      scheduledFor: laborAnnouncedAt + 60_000,
      notificationType: "labor_started",
      customMessage: null,
      createdAt: laborAnnouncedAt,
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

  // A timeline post during the deploy window created the hospital row before
  // backfill ran; backfill must still fill in the other milestone and photo.
  vi.advanceTimersByTime(1_000);
  await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "gone_to_hospital",
    occurredAt: wentToHospitalAt.getTime(),
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
    // Hospital dual-write announces ~now; photo's storage upload is slightly earlier
    {
      kind: "update",
      update: {
        milestone: "gone_to_hospital",
        occurredAt: wentToHospitalAt.getTime(),
      },
    },
    { kind: "update", update: { milestone: null, message: null } },
    { kind: "encouragement", encouragement: { authorName: "Grandma" } },
    // Labour announced via notification (before Grandma replied)
    {
      kind: "update",
      postedAt: laborAnnouncedAt,
      update: {
        milestone: "labor_started",
        message: "It has begun!",
        occurredAt: laborStartedAt.getTime(),
      },
    },
    { kind: "encouragement", encouragement: { authorName: "Aunt Meg" } },
  ]);
  const photoItem = feed.page[1];
  expect(photoItem?.kind === "update" && photoItem.update.photoUrl).toBeTruthy();
  expect(photoItem?.kind === "update" && photoItem.update.thumbnailUrl).toBeTruthy();

  // The photo row's postedAt is the storage file's original upload time
  const photoUploadedAt = await t.run(async (ctx) => {
    const fileMetadata = await ctx.db.system.get(photo);
    return fileMetadata?._creationTime;
  });
  expect(photoUploadedAt).toBeTruthy();
  expect(photoItem?.postedAt).toBe(photoUploadedAt);

  // Clearing the legacy stage messages keeps the feed content intact
  await t.run(async (ctx) => {
    const baby = await ctx.db.get(babyId);
    if (!baby) throw new Error("Baby not found");
    await clearLegacyStageMessagesDoc(ctx, baby);
  });
  const clearedBaby = await getBaby(t, babyId);
  expect(clearedBaby.laborStartedMessage).toBeNull();
  expect(clearedBaby.hospitalMessage ?? null).toBeNull();
  expect(clearedBaby.babyBornMessage ?? null).toBeNull();
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

  await asAlice.mutation(api.updates.unmarkMilestone, {
    babyId,
    milestone: "gone_to_hospital",
  });
  const after = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(after.page).toHaveLength(4);
});

test("backfill rejects an invalid legacy milestone date", async () => {
  const { t, babyId } = await setup();
  await t.run(async (ctx) => {
    await ctx.db.patch(babyId, { laborStarted: "not-a-date" });
  });

  await expect(
    t.run(async (ctx) => {
      const baby = await ctx.db.get(babyId);
      if (!baby) throw new Error("Baby not found");
      await backfillBabyTimelineDoc(ctx, baby);
    }),
  ).rejects.toThrow("has an invalid laborStarted");
});

test("backfill rejects a milestone update without a usable timestamp", async () => {
  const { t, babyId } = await setup();
  await t.run(async (ctx) => {
    await ctx.db.patch(babyId, { laborStarted: "2026-08-10T08:00:00.000Z" });
    const { timelineItemId } = await insertUpdateWithTimelineItem(ctx, {
      babyId,
      postedAt: Date.parse("2026-08-10T08:00:00.000Z"),
      milestone: "labor_started",
    });
    await ctx.db.delete(timelineItemId);
  });

  await expect(
    t.run(async (ctx) => {
      const baby = await ctx.db.get(babyId);
      if (!baby) throw new Error("Baby not found");
      await backfillBabyTimelineDoc(ctx, baby);
    }),
  ).rejects.toThrow("has no usable timeline timestamp");
});

test("clearLegacyStageMessages only clears fields with a proven durable destination", async () => {
  const { t, babyId } = await setup();
  const laborAt = new Date(Date.now() - 10 * 60 * 60 * 1000);
  const hospitalAt = new Date(Date.now() - 5 * 60 * 60 * 1000);

  await t.run(async (ctx) => {
    // Unmarked stage with a prepped message (old Settings allowed this):
    // babyBorn is null but babyBornMessage has text
    // Marked stage whose row carries a DIFFERENT message (edited since):
    // laborStarted + row("Newer edit") vs field("Original labour note")
    // Marked stage whose row has a null message: wentToHospital
    await ctx.db.patch(babyId, {
      laborStarted: laborAt.toISOString(),
      laborStartedMessage: "Original labour note",
      wentToHospital: hospitalAt.toISOString(),
      hospitalMessage: "Checked in!",
      babyBornMessage: "Prepped for the big day",
    });
    await insertUpdateWithTimelineItem(ctx, {
      babyId,
      postedAt: laborAt.getTime(),
      occurredAt: laborAt.getTime(),
      milestone: "labor_started",
      message: "Newer edit",
    });
    await insertUpdateWithTimelineItem(ctx, {
      babyId,
      postedAt: hospitalAt.getTime(),
      occurredAt: hospitalAt.getTime(),
      milestone: "gone_to_hospital",
    });
  });

  const runClear = async () => {
    await t.run(async (ctx) => {
      const baby = await ctx.db.get(babyId);
      if (!baby) throw new Error("Baby not found");
      await clearLegacyStageMessagesDoc(ctx, baby);
    });
  };
  await runClear();
  // Idempotent: a re-run must not change the outcome
  await runClear();

  const baby = await getBaby(t, babyId);
  // No durable destination → preserved
  expect(baby.babyBornMessage).toBe("Prepped for the big day");
  expect(baby.laborStartedMessage).toBe("Original labour note");
  // Healed onto the row → cleared
  expect(baby.hospitalMessage).toBeNull();

  const updates = await t.run(async (ctx) => {
    return await ctx.db
      .query("updates")
      .withIndex("by_babyId", (q) => q.eq("babyId", babyId))
      .collect();
  });
  // No public update was invented for the unmarked "born" stage
  expect(updates).toHaveLength(2);
  expect(updates.find((u) => u.milestone === "labor_started")?.message).toBe("Newer edit");
  expect(updates.find((u) => u.milestone === "gone_to_hospital")?.message).toBe("Checked in!");
});

test("redating validates the timestamp and requires an existing milestone", async () => {
  const { asAlice, babyId } = await setup();

  await expect(
    asAlice.mutation(api.updates.redateMilestone, {
      babyId,
      milestone: "labor_started",
      occurredAt: Date.now(),
    }),
  ).rejects.toThrow("Milestone update not found");

  await asAlice.mutation(api.updates.post, { babyId, milestone: "labor_started" });

  await expect(
    asAlice.mutation(api.updates.redateMilestone, {
      babyId,
      milestone: "labor_started",
      occurredAt: Number.MAX_VALUE,
    }),
  ).rejects.toThrow("Invalid date");

  await expect(
    asAlice.mutation(api.updates.redateMilestone, {
      babyId,
      milestone: "labor_started",
      occurredAt: Date.now() + 2 * 60 * 60 * 1000,
    }),
  ).rejects.toThrow("The event time cannot be in the future");
});

test("posting a milestone rejects non-finite and out-of-range timestamps", async () => {
  const { asAlice, babyId } = await setup();

  for (const occurredAt of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
    await expect(
      asAlice.mutation(api.updates.post, {
        babyId,
        milestone: "labor_started",
        occurredAt,
      }),
    ).rejects.toThrow("Invalid date");
  }
});

test("separateMilestoneOccurredAt moves backdated milestones to announce time", async () => {
  const { t, babyId } = await setup();
  const eventAt = Date.parse("2026-01-11T04:14:00.000Z");
  const announcedAt = Date.parse("2026-01-11T10:13:18.796Z");

  const updateId = await t.run(async (ctx) => {
    await ctx.db.patch(babyId, { babyBorn: new Date(eventAt).toISOString() });
    // Legacy shape: postedAt was the event clock
    const { updateId } = await insertUpdateWithTimelineItem(ctx, {
      babyId,
      postedAt: eventAt,
      milestone: "born",
      message: "She's here!",
    });
    await ctx.db.insert("scheduledNotifications", {
      babyId,
      status: "cancelled",
      scheduledFor: announcedAt + 60_000,
      notificationType: "born",
      customMessage: null,
      createdAt: announcedAt,
    });
    return updateId;
  });

  await t.run(async (ctx) => {
    const update = await ctx.db.get(updateId);
    if (!update) throw new Error("update missing");
    await separateMilestoneOccurredAtDoc(ctx, update);
    // Idempotent
    const again = await ctx.db.get(updateId);
    if (!again) throw new Error("update missing");
    await separateMilestoneOccurredAtDoc(ctx, again);
  });

  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([
    {
      kind: "update",
      postedAt: announcedAt,
      update: { milestone: "born", occurredAt: eventAt },
    },
  ]);
});

test("separateMilestoneOccurredAt prefers the notification closest to the update", async () => {
  const { t, babyId } = await setup();
  const eventAt = Date.parse("2026-03-01T12:00:00.000Z");
  const staleAnnounceAt = Date.parse("2026-01-11T10:00:00.000Z");
  const freshAnnounceAt = Date.parse("2026-03-01T12:05:00.000Z");

  const updateId = await t.run(async (ctx) => {
    await ctx.db.patch(babyId, { babyBorn: new Date(eventAt).toISOString() });
    const { updateId } = await insertUpdateWithTimelineItem(ctx, {
      babyId,
      postedAt: eventAt,
      milestone: "born",
    });
    // Prior unmark left a cancelled notification; remark created a new one
    await ctx.db.insert("scheduledNotifications", {
      babyId,
      status: "cancelled",
      scheduledFor: staleAnnounceAt + 60_000,
      notificationType: "born",
      customMessage: null,
      createdAt: staleAnnounceAt,
    });
    await ctx.db.insert("scheduledNotifications", {
      babyId,
      status: "sent",
      scheduledFor: freshAnnounceAt + 60_000,
      notificationType: "born",
      customMessage: null,
      createdAt: freshAnnounceAt,
    });
    return updateId;
  });

  await t.run(async (ctx) => {
    const update = await ctx.db.get(updateId);
    if (!update) throw new Error("update missing");
    await separateMilestoneOccurredAtDoc(ctx, update);
  });

  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([{ postedAt: freshAnnounceAt, update: { occurredAt: eventAt } }]);
});

test("separateMilestoneOccurredAt still fixes postedAt after a redate set occurredAt", async () => {
  const { t, babyId } = await setup();
  const originalEventAt = Date.parse("2026-01-11T04:14:00.000Z");
  const redatedEventAt = Date.parse("2026-01-11T06:00:00.000Z");
  const announcedAt = Date.parse("2026-01-11T10:13:18.796Z");

  const updateId = await t.run(async (ctx) => {
    await ctx.db.patch(babyId, { babyBorn: new Date(originalEventAt).toISOString() });
    const { updateId, timelineItemId } = await insertUpdateWithTimelineItem(ctx, {
      babyId,
      postedAt: originalEventAt,
      occurredAt: redatedEventAt, // a concurrent redate already won
      milestone: "born",
    });
    await ctx.db.insert("scheduledNotifications", {
      babyId,
      status: "sent",
      scheduledFor: announcedAt + 60_000,
      notificationType: "born",
      customMessage: null,
      createdAt: announcedAt,
    });
    // Sanity: postedAt still on the old event clock
    const item = await ctx.db.get(timelineItemId);
    expect(item?.postedAt).toBe(originalEventAt);
    return updateId;
  });

  await t.run(async (ctx) => {
    const update = await ctx.db.get(updateId);
    if (!update) throw new Error("update missing");
    await separateMilestoneOccurredAtDoc(ctx, update);
  });

  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toMatchObject([
    { postedAt: announcedAt, update: { occurredAt: redatedEventAt } },
  ]);
});

test("posting a milestone sets occurredAt to the announce time", async () => {
  const { t, asAlice, babyId } = await setup();
  const before = Date.now();
  await asAlice.mutation(api.updates.post, { babyId, milestone: "labor_started" });
  const after = Date.now();

  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toHaveLength(1);
  const item = feed.page[0];
  if (item?.kind !== "update") throw new Error("expected update");
  expect(item.postedAt).toBeGreaterThanOrEqual(before);
  expect(item.postedAt).toBeLessThanOrEqual(after);
  expect(item.update.occurredAt).toBe(item.postedAt);
});

test("posting a milestone can backdate the event clock without moving the feed", async () => {
  const { t, asAlice, babyId } = await setup();
  const occurredAt = Date.now() - 6 * 60 * 60 * 1000;

  const before = Date.now();
  await asAlice.mutation(api.updates.post, {
    babyId,
    milestone: "labor_started",
    message: "Started overnight, telling you all now!",
    occurredAt,
  });
  const after = Date.now();

  // The feed slot is the announce time; the event clock is the backdated time
  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  expect(feed.page).toHaveLength(1);
  const item = feed.page[0];
  if (item?.kind !== "update") throw new Error("expected update");
  expect(item.postedAt).toBeGreaterThanOrEqual(before);
  expect(item.postedAt).toBeLessThanOrEqual(after);
  expect(item.update.occurredAt).toBe(occurredAt);

  // Inferred status uses the event clock, not the announce time
  const publicBaby = await t.query(api.baby.getByPublicId, { id: babyId });
  expect(publicBaby?.laborStarted).toBe(new Date(occurredAt).toISOString());
  const stored = await getBaby(t, babyId);
  expect(stored.laborStarted).toBeUndefined();
});

test("a backdated event time is rejected when in the future or without a milestone", async () => {
  const { asAlice, babyId } = await setup();

  await expect(
    asAlice.mutation(api.updates.post, {
      babyId,
      milestone: "labor_started",
      occurredAt: Date.now() + 60 * 60 * 1000,
    }),
  ).rejects.toThrow("The event time cannot be in the future");

  await expect(
    asAlice.mutation(api.updates.post, {
      babyId,
      message: "Just a message",
      occurredAt: Date.now() - 60 * 60 * 1000,
    }),
  ).rejects.toThrow("A backdated time requires a status change");
});
