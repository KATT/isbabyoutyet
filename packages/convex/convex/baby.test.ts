import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "./_generated/api";
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
      role: "owner",
    },
  ]);
  expect(babies[0]).not.toHaveProperty("userId");
  expect(babies[0]).not.toHaveProperty("ownerTokenIdentifier");
  expect(babies[0]).not.toHaveProperty("lastActivityAt");
  expect(babies[0]).not.toHaveProperty("subscriptionCount");

  // Other users (and anonymous visitors) don't see it in their list
  const asBob = t.withIdentity({ subject: "bob" });
  expect(await asBob.query(api.baby.listByUser, {})).toEqual([]);
  const sameSubjectFromAnotherIssuer = t.withIdentity({
    subject: "alice",
    issuer: "https://other-issuer.test",
  });
  expect(await sameSubjectFromAnotherIssuer.query(api.baby.listByUser, {})).toEqual([]);
  await expect(
    sameSubjectFromAnotherIssuer.mutation(api.baby.update, {
      babyId: created.babyId,
      name: "Not Alice",
    }),
  ).rejects.toThrow("Not authorized");
  expect(await t.query(api.baby.listByUser, {})).toEqual([]);
});

test("a planned C-section baby stores its journey and cannot mark labour", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby Nova",
    dueDate: "2026-09-01",
    birthJourney: "planned_c_section",
  });

  expect(await t.query(api.baby.getByPublicId, { id: created.publicId })).toMatchObject({
    birthJourney: "planned_c_section",
  });
  await expect(
    asAlice.mutation(api.baby.update, {
      babyId: created.babyId,
      laborStarted: "2026-08-10T08:00:00.000Z",
    }),
  ).rejects.toThrow("Labour started is not part of a planned C-section journey");

  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    wentToHospital: "2026-08-10T08:00:00.000Z",
  });
  expect(await t.query(api.baby.getByPublicId, { id: created.publicId })).toMatchObject({
    wentToHospital: "2026-08-10T08:00:00.000Z",
  });
});

test("switching to a planned C-section journey preserves milestone integrity", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby Nova",
    dueDate: "2026-09-01",
  });
  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    laborStarted: "2026-08-10T08:00:00.000Z",
  });

  await expect(
    asAlice.mutation(api.baby.update, {
      babyId: created.babyId,
      birthJourney: "planned_c_section",
    }),
  ).rejects.toThrow("Remove the Labour started milestone before switching birth journey");
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
  expect(byPublicId).not.toHaveProperty("userId");
  expect(byPublicId).not.toHaveProperty("ownerTokenIdentifier");
  expect(byPublicId).not.toHaveProperty("lastActivityAt");
  expect(byPublicId).not.toHaveProperty("subscriptionCount");

  const byDocumentId = await t.query(api.baby.getByPublicId, { id: created.babyId });
  expect(byDocumentId).toMatchObject({ publicId: created.publicId });
});

test("a baby inherits the owner locale until an override is set", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });
  await asAlice.mutation(api.profile.ensure, { browserLocale: "sv-SE" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Little One",
    dueDate: "2026-10-15",
  });

  expect(await t.query(api.baby.getByPublicId, { id: created.publicId })).toMatchObject({
    resolvedLocale: "sv",
  });

  await asAlice.mutation(api.profile.updateLocale, { locale: "es" });
  expect(await t.query(api.baby.getByPublicId, { id: created.publicId })).toMatchObject({
    resolvedLocale: "es",
  });

  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    locale: "en-US",
  });
  expect(await t.query(api.baby.getByPublicId, { id: created.publicId })).toMatchObject({
    locale: "en-US",
    resolvedLocale: "en-US",
  });

  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    locale: null,
  });
  expect(await t.query(api.baby.getByPublicId, { id: created.publicId })).toMatchObject({
    locale: null,
    resolvedLocale: "es",
  });
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

  const sameSubjectFromAnotherIssuer = t.withIdentity({
    subject: "alice",
    issuer: "https://other-issuer.test",
  });
  const impostorBaby = await sameSubjectFromAnotherIssuer.mutation(api.baby.create, {
    name: "Working Title",
    dueDate: "2026-09-01",
  });
  expect(impostorBaby.publicId).toBe("working-title-1");
});

test("homepage demo publicIds are reserved and never assigned to real babies", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, {
    name: "Juniper Hale",
    dueDate: "2026-09-01",
  });
  expect(created.publicId).toBe("juniper-hale-1");
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
    laborStarted: "2026-08-10T08:00:00.000Z",
  });

  const notifications = await asAlice.query(api.baby.getScheduledNotifications, {
    babyId: created.babyId,
  });
  expect(notifications).toMatchObject([
    {
      status: "pending",
      notificationType: "labor_started",
      customMessage: null,
    },
  ]);

  // Moving further forward cancels the pending one and schedules the next
  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    babyBorn: "2026-08-11T03:00:00.000Z",
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

test("owner can soft-delete a baby; it disappears from lists and public lookup", async () => {
  await using _timers = useFakeTimersResource();
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });
  const asBob = t.withIdentity({ subject: "bob" });

  const created = await asAlice.mutation(api.baby.create, {
    name: "Soft Delete Me",
    dueDate: "2026-09-01",
  });

  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    laborStarted: "2026-08-10T08:00:00.000Z",
  });

  await expect(asBob.mutation(api.baby.remove, { babyId: created.babyId })).rejects.toThrow(
    "Not authorized",
  );

  await asAlice.mutation(api.baby.remove, { babyId: created.babyId });

  expect(await asAlice.query(api.baby.listByUser, {})).toEqual([]);
  expect(await t.query(api.baby.getByPublicId, { id: created.publicId })).toBeNull();

  const stored = await t.run(async (ctx) => ctx.db.get(created.babyId));
  expect(stored?.deletedAt).toEqual(expect.any(Number));

  const notifications = await t.run(async (ctx) => {
    return await ctx.db
      .query("scheduledNotifications")
      .withIndex("by_babyId", (q) => q.eq("babyId", created.babyId))
      .collect();
  });
  expect(notifications.every((n) => n.status === "cancelled")).toBe(true);
});
