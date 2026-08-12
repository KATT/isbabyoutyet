import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { makeResource } from "./test.resource";
import { modules, registerComponents } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  return t;
}

function useFakeTimersResource() {
  vi.useFakeTimers();
  return makeResource({}, () => {
    vi.useRealTimers();
  });
}

test("create a baby and list it for the owner", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby Smith",
    dueDate: "2026-09-01",
  });

  expect(created.publicId).toBe("baby-smith");

  const babies = await asAlice.query(api.baby.listByUser, {});
  expect(babies).toMatchObject([
    {
      _id: created.babyId,
      name: "Baby Smith",
      dueDate: "2026-09-01",
      publicId: "baby-smith",
      userId: "alice",
    },
  ]);

  // Other users (and anonymous visitors) don't see it in their list
  const asBob = t.withIdentity({ subject: "bob" });
  expect(await asBob.query(api.baby.listByUser, {})).toEqual([]);
  expect(await t.query(api.baby.listByUser, {})).toEqual([]);
});

test("getByPublicId resolves by publicId and by document id", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, {
    name: "Little One",
    dueDate: "2026-10-15",
  });

  const byPublicId = await t.query(api.baby.getByPublicId, { id: created.publicId });
  expect(byPublicId).toMatchObject({ _id: created.babyId, name: "Little One" });

  const byDocumentId = await t.query(api.baby.getByPublicId, { id: created.babyId });
  expect(byDocumentId).toMatchObject({ publicId: created.publicId });
});

test("renaming a baby rotates the publicId and keeps the old one resolvable", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, {
    name: "Working Title",
    dueDate: "2026-09-01",
  });
  expect(created.publicId).toBe("working-title");

  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    name: "Final Name",
  });

  const byNewPublicId = await t.query(api.baby.getByPublicId, { id: "final-name" });
  expect(byNewPublicId).toMatchObject({ _id: created.babyId, name: "Final Name" });

  // Historical publicId still resolves to the same baby
  const byOldPublicId = await t.query(api.baby.getByPublicId, { id: "working-title" });
  expect(byOldPublicId).toMatchObject({ _id: created.babyId, name: "Final Name" });
});

test("create deduplicates publicIds, including historic ones from renames", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });
  const asBob = t.withIdentity({ subject: "bob" });

  const first = await asAlice.mutation(api.baby.create, { name: "Baby", dueDate: "2026-09-01" });
  expect(first.publicId).toBe("baby");

  // Same slug again -> numeric suffix
  const second = await asBob.mutation(api.baby.create, { name: "Baby!", dueDate: "2026-09-01" });
  expect(second.publicId).toBe("baby-1");

  // Renaming frees the slug but keeps it reserved for the same owner
  await asAlice.mutation(api.baby.update, { babyId: first.babyId, name: "New Name" });

  const bobsThird = await asBob.mutation(api.baby.create, { name: "Baby", dueDate: "2026-09-01" });
  expect(bobsThird.publicId).toBe("baby-2");

  const alicesReclaim = await asAlice.mutation(api.baby.create, {
    name: "Baby",
    dueDate: "2026-09-01",
  });
  expect(alicesReclaim.publicId).toBe("baby");
});

test("create and getByPublicId reject or miss gracefully", async () => {
  const t = await setup();

  await expect(
    t.mutation(api.baby.create, { name: "Baby", dueDate: "2026-09-01" }),
  ).rejects.toThrow("Not authenticated");

  expect(await t.query(api.baby.getByPublicId, { id: "does-not-exist" })).toBeNull();
});

test("getByPublicId returns photo and thumbnail urls when set", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, { name: "Baby", dueDate: "2026-09-01" });
  const photoId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["photo"])));
  const thumbnailId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["thumb"])));
  await t.run(async (ctx) => {
    await ctx.db.patch(created.babyId, { photoId, thumbnailId });
  });

  const baby = await t.query(api.baby.getByPublicId, { id: created.publicId });
  expect(baby?.photoUrl).toEqual(expect.any(String));
  expect(baby?.thumbnailUrl).toEqual(expect.any(String));
});

test("generateUploadUrl requires an authenticated owner of an existing baby", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, { name: "Baby", dueDate: "2026-09-01" });

  await expect(t.mutation(api.baby.generateUploadUrl, { babyId: created.babyId })).rejects.toThrow(
    "Not authenticated",
  );

  const asBob = t.withIdentity({ subject: "bob" });
  await expect(
    asBob.mutation(api.baby.generateUploadUrl, { babyId: created.babyId }),
  ).rejects.toThrow("Not authorized");

  const uploadUrl = await asAlice.mutation(api.baby.generateUploadUrl, {
    babyId: created.babyId,
  });
  expect(uploadUrl).toEqual(expect.any(String));

  await t.run(async (ctx) => {
    await ctx.db.delete(created.babyId);
  });
  await expect(
    asAlice.mutation(api.baby.generateUploadUrl, { babyId: created.babyId }),
  ).rejects.toThrow("Baby not found");
});

test("update validates auth, existence and ownership", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, { name: "Baby", dueDate: "2026-09-01" });

  await expect(
    t.mutation(api.baby.update, { babyId: created.babyId, name: "Nope" }),
  ).rejects.toThrow("Not authenticated");

  const asBob = t.withIdentity({ subject: "bob" });
  await expect(
    asBob.mutation(api.baby.update, { babyId: created.babyId, name: "Nope" }),
  ).rejects.toThrow("Not authorized");

  await t.run(async (ctx) => {
    await ctx.db.delete(created.babyId);
  });
  await expect(
    asAlice.mutation(api.baby.update, { babyId: created.babyId, name: "Nope" }),
  ).rejects.toThrow("Baby not found");
});

test("status notifications use the stored message when no override is passed", async () => {
  await using _timers = useFakeTimersResource();

  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, { name: "Baby", dueDate: "2026-09-01" });
  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    hospitalMessage: "Please only text us",
  });

  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    wentToHospital: "2026-08-20T10:00:00.000Z",
  });

  const notifications = await asAlice.query(api.baby.getScheduledNotifications, {
    babyId: created.babyId,
  });
  expect(notifications).toMatchObject([
    {
      status: "pending",
      notificationType: "gone_to_hospital",
      customMessage: "Please only text us",
    },
  ]);
});

test("moving the status backwards cancels pending notifications without scheduling new ones", async () => {
  await using _timers = useFakeTimersResource();

  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, { name: "Baby", dueDate: "2026-09-01" });
  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    laborStarted: "2026-08-20T08:00:00.000Z",
  });

  // Un-mark labor: status moves backwards
  await asAlice.mutation(api.baby.update, { babyId: created.babyId, laborStarted: null });

  const notifications = await asAlice.query(api.baby.getScheduledNotifications, {
    babyId: created.babyId,
  });
  expect(notifications).toMatchObject([{ status: "cancelled", notificationType: "labor_started" }]);
});

test("getScheduledNotifications validates auth, existence and ownership", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, { name: "Baby", dueDate: "2026-09-01" });

  await expect(
    t.query(api.baby.getScheduledNotifications, { babyId: created.babyId }),
  ).rejects.toThrow("Not authenticated");

  const asBob = t.withIdentity({ subject: "bob" });
  await expect(
    asBob.query(api.baby.getScheduledNotifications, { babyId: created.babyId }),
  ).rejects.toThrow("Not authorized");

  await t.run(async (ctx) => {
    await ctx.db.delete(created.babyId);
  });
  await expect(
    asAlice.query(api.baby.getScheduledNotifications, { babyId: created.babyId }),
  ).rejects.toThrow("Baby not found");
});

test("cancelScheduledNotification handles missing notifications and babies", async () => {
  await using _timers = useFakeTimersResource();

  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, { name: "Baby", dueDate: "2026-09-01" });
  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    laborStarted: "2026-08-20T08:00:00.000Z",
  });
  const [pending] = await asAlice.query(api.baby.getScheduledNotifications, {
    babyId: created.babyId,
  });

  await t.run(async (ctx) => {
    await ctx.db.delete(created.babyId);
  });
  await expect(
    asAlice.mutation(api.baby.cancelScheduledNotification, { notificationId: pending._id }),
  ).rejects.toThrow("Baby not found");

  await t.run(async (ctx) => {
    await ctx.db.delete(pending._id);
  });
  await expect(
    asAlice.mutation(api.baby.cancelScheduledNotification, { notificationId: pending._id }),
  ).rejects.toThrow("Notification not found");
});

test("markNotificationSent marks pending notifications and ignores the rest", async () => {
  await using _timers = useFakeTimersResource();

  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, { name: "Baby", dueDate: "2026-09-01" });
  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    laborStarted: "2026-08-20T08:00:00.000Z",
  });
  const [pending] = await asAlice.query(api.baby.getScheduledNotifications, {
    babyId: created.babyId,
  });

  await t.mutation(internal.baby.markNotificationSent, { notificationId: pending._id });
  let notifications = await asAlice.query(api.baby.getScheduledNotifications, {
    babyId: created.babyId,
  });
  expect(notifications).toMatchObject([{ status: "sent" }]);

  // Already sent -> stays sent
  await t.mutation(internal.baby.markNotificationSent, { notificationId: pending._id });
  notifications = await asAlice.query(api.baby.getScheduledNotifications, {
    babyId: created.babyId,
  });
  expect(notifications).toMatchObject([{ status: "sent" }]);

  // Deleted -> no-op
  await t.run(async (ctx) => {
    await ctx.db.delete(pending._id);
  });
  await t.mutation(internal.baby.markNotificationSent, { notificationId: pending._id });
});

test("updateThumbnail patches the thumbnail id", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, { name: "Baby", dueDate: "2026-09-01" });
  const thumbnailId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["thumb"])));

  await t.mutation(internal.baby.updateThumbnail, { babyId: created.babyId, thumbnailId });

  const baby = await t.query(api.baby.getByPublicId, { id: created.publicId });
  expect(baby).toMatchObject({ thumbnailId });
});

test("renaming to a name that slugifies to the current publicId keeps it", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby Smith",
    dueDate: "2026-09-01",
  });
  expect(created.publicId).toBe("baby-smith");

  await asAlice.mutation(api.baby.update, { babyId: created.babyId, name: "BABY   SMITH!" });

  const baby = await t.query(api.baby.getByPublicId, { id: "baby-smith" });
  expect(baby).toMatchObject({ name: "BABY   SMITH!", publicId: "baby-smith" });
});

test("updatePhoto stores the photo, schedules a thumbnail and notifies on first photo only", async () => {
  await using _timers = useFakeTimersResource();

  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby",
    dueDate: "2026-09-01",
  });

  const firstPhotoId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["photo-1"])));
  await asAlice.mutation(api.baby.updatePhoto, {
    babyId: created.babyId,
    photoId: firstPhotoId,
  });

  const baby = await t.query(api.baby.getByPublicId, { id: created.publicId });
  expect(baby).toMatchObject({ photoId: firstPhotoId, thumbnailId: null });

  const notifications = await asAlice.query(api.baby.getScheduledNotifications, {
    babyId: created.babyId,
  });
  expect(notifications).toMatchObject([{ status: "pending", notificationType: "photo_added" }]);

  // A second photo shouldn't trigger another notification
  const secondPhotoId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["photo-2"])));
  await asAlice.mutation(api.baby.updatePhoto, {
    babyId: created.babyId,
    photoId: secondPhotoId,
  });

  const afterSecondPhoto = await asAlice.query(api.baby.getScheduledNotifications, {
    babyId: created.babyId,
  });
  expect(afterSecondPhoto).toHaveLength(1);
});

test("updatePhoto rejects anonymous users and non-owners", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby",
    dueDate: "2026-09-01",
  });

  await expect(
    t.mutation(api.baby.updatePhoto, { babyId: created.babyId, photoId: null }),
  ).rejects.toThrow("Not authenticated");

  const asBob = t.withIdentity({ subject: "bob" });
  await expect(
    asBob.mutation(api.baby.updatePhoto, { babyId: created.babyId, photoId: null }),
  ).rejects.toThrow("Not authorized");
});

test("cancelScheduledNotification cancels a pending notification exactly once", async () => {
  await using _timers = useFakeTimersResource();

  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby",
    dueDate: "2026-09-01",
  });
  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    laborStarted: "2026-08-20T08:00:00.000Z",
  });

  const [pending] = await asAlice.query(api.baby.getScheduledNotifications, {
    babyId: created.babyId,
  });
  expect(pending).toMatchObject({ status: "pending" });

  // Only the owner may cancel
  const asBob = t.withIdentity({ subject: "bob" });
  await expect(
    asBob.mutation(api.baby.cancelScheduledNotification, { notificationId: pending._id }),
  ).rejects.toThrow("Not authorized");
  await expect(
    t.mutation(api.baby.cancelScheduledNotification, { notificationId: pending._id }),
  ).rejects.toThrow("Not authenticated");

  await asAlice.mutation(api.baby.cancelScheduledNotification, { notificationId: pending._id });

  const afterCancel = await asAlice.query(api.baby.getScheduledNotifications, {
    babyId: created.babyId,
  });
  expect(afterCancel).toMatchObject([{ status: "cancelled" }]);

  // Cancelling again is rejected because it is no longer pending
  await expect(
    asAlice.mutation(api.baby.cancelScheduledNotification, { notificationId: pending._id }),
  ).rejects.toThrow("Notification is not pending");
});

test("moving the status forward schedules a push notification", async () => {
  await using _timers = useFakeTimersResource();

  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby",
    dueDate: "2026-09-01",
  });

  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    laborStarted: "2026-08-20T08:00:00.000Z",
    laborStartedMessage: "It has begun!",
  });

  const notifications = await asAlice.query(api.baby.getScheduledNotifications, {
    babyId: created.babyId,
  });
  expect(notifications).toMatchObject([
    {
      status: "pending",
      notificationType: "labor_started",
      customMessage: "It has begun!",
    },
  ]);

  // Moving further forward cancels the pending one and schedules the next
  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    babyBorn: "2026-08-21T03:00:00.000Z",
  });

  const afterBirth = await asAlice.query(api.baby.getScheduledNotifications, {
    babyId: created.babyId,
  });
  expect(afterBirth).toHaveLength(2);
  expect(afterBirth).toMatchObject([
    { status: "pending", notificationType: "born" },
    { status: "cancelled", notificationType: "labor_started" },
  ]);
});
