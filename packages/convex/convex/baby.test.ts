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
