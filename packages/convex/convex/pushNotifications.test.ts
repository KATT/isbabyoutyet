import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import webPush from "web-push";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { makeResource } from "./test.resource";
import { modules, registerComponents } from "./test.setup";

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async () => ({})),
  },
}));

const sendNotificationMock = vi.mocked(webPush.sendNotification);

function useVapidEnvResource() {
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
  vi.stubEnv("VAPID_PUBLIC_KEY", "test-public-key");
  vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
  vi.stubEnv("SITE_URL", "https://example.com");
  return makeResource({}, () => {
    vi.unstubAllEnvs();
    sendNotificationMock.mockReset();
    sendNotificationMock.mockResolvedValue({} as never);
  });
}

async function setup() {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby Smith",
    dueDate: "2026-09-01",
  });

  const notificationId = await t.run(async (ctx) => {
    return await ctx.db.insert("scheduledNotifications", {
      babyId: created.babyId,
      status: "pending",
      scheduledFor: Date.now(),
      notificationType: "born",
      customMessage: null,
      createdAt: Date.now(),
    });
  });

  return { t, babyId: created.babyId, publicId: created.publicId, notificationId };
}

function sendArgs(opts: {
  notificationId: Id<"scheduledNotifications">;
  babyId: Id<"baby">;
  publicId: string;
  status: "labor_started" | "gone_to_hospital" | "born" | "photo_added";
  customMessage?: string | null;
}) {
  return {
    notificationId: opts.notificationId,
    babyId: opts.babyId,
    babyName: "Baby Smith",
    publicId: opts.publicId,
    status: opts.status,
    customMessage: opts.customMessage ?? null,
  };
}

test("sendNotification pushes to every subscriber and marks the notification sent", async () => {
  await using _env = useVapidEnvResource();
  const { t, babyId, publicId, notificationId } = await setup();

  await t.mutation(api.pushSubscriptions.subscribe, {
    babyId,
    endpoint: "https://push.example.com/a",
    p256dh: "key-a",
    auth: "auth-a",
  });
  await t.mutation(api.pushSubscriptions.subscribe, {
    babyId,
    endpoint: "https://push.example.com/b",
    p256dh: "key-b",
    auth: "auth-b",
  });

  await t.action(
    internal.pushNotifications.sendNotification,
    sendArgs({ notificationId, babyId, publicId, status: "born", customMessage: "She is here!" }),
  );

  expect(sendNotificationMock).toHaveBeenCalledTimes(2);
  const [subscription, payload] = sendNotificationMock.mock.calls[0];
  expect(subscription).toMatchObject({
    endpoint: "https://push.example.com/a",
    keys: { p256dh: "key-a", auth: "auth-a" },
  });
  expect(JSON.parse(payload as string)).toMatchObject({
    title: "Baby Smith is here! 🎉",
    body: "She is here!",
    url: `/baby/${publicId}`,
  });

  const notification = await t.run(async (ctx) => await ctx.db.get(notificationId));
  expect(notification).toMatchObject({ status: "sent" });
});

test.each([
  ["labor_started", "Baby Smith - Labor has started!", "Labor has begun. Check for updates!"],
  [
    "gone_to_hospital",
    "Baby Smith is on the way to the hospital!",
    "They're heading to the hospital. Check for updates!",
  ],
  ["photo_added", "Baby Smith - New photo! 📸", "A new photo has been added. Check it out!"],
] as const)("sendNotification builds the %s payload", async (status, title, body) => {
  await using _env = useVapidEnvResource();
  const { t, babyId, publicId, notificationId } = await setup();

  await t.mutation(api.pushSubscriptions.subscribe, {
    babyId,
    endpoint: "https://push.example.com/a",
    p256dh: "key-a",
    auth: "auth-a",
  });

  await t.action(
    internal.pushNotifications.sendNotification,
    sendArgs({ notificationId, babyId, publicId, status }),
  );

  const [, payload] = sendNotificationMock.mock.calls[0];
  expect(JSON.parse(payload as string)).toMatchObject({ title, body });
});

test("a 404 push failure also deletes the dead subscription", async () => {
  await using _env = useVapidEnvResource();
  const { t, babyId, publicId, notificationId } = await setup();

  await t.mutation(api.pushSubscriptions.subscribe, {
    babyId,
    endpoint: "https://push.example.com/gone",
    p256dh: "key",
    auth: "auth",
  });
  sendNotificationMock.mockRejectedValueOnce(
    Object.assign(new Error("Not found"), { statusCode: 404 }),
  );

  await t.action(
    internal.pushNotifications.sendNotification,
    sendArgs({ notificationId, babyId, publicId, status: "born" }),
  );
  expect(await t.query(api.pushSubscriptions.getSubscriptions, { babyId })).toEqual([]);
});

test("a non-Error push rejection keeps the subscription", async () => {
  await using _env = useVapidEnvResource();
  const { t, babyId, publicId, notificationId } = await setup();

  await t.mutation(api.pushSubscriptions.subscribe, {
    babyId,
    endpoint: "https://push.example.com/weird",
    p256dh: "key",
    auth: "auth",
  });
  sendNotificationMock.mockRejectedValueOnce("string rejection" as never);

  await t.action(
    internal.pushNotifications.sendNotification,
    sendArgs({ notificationId, babyId, publicId, status: "born" }),
  );
  expect(await t.query(api.pushSubscriptions.getSubscriptions, { babyId })).toHaveLength(1);
});

test("a 410 push failure deletes the dead subscription, other failures keep it", async () => {
  await using _env = useVapidEnvResource();
  const { t, babyId, publicId, notificationId } = await setup();

  await t.mutation(api.pushSubscriptions.subscribe, {
    babyId,
    endpoint: "https://push.example.com/dead",
    p256dh: "key",
    auth: "auth",
  });

  const goneError = Object.assign(new Error("Gone"), { statusCode: 410 });
  sendNotificationMock.mockRejectedValueOnce(goneError);

  await t.action(
    internal.pushNotifications.sendNotification,
    sendArgs({ notificationId, babyId, publicId, status: "born" }),
  );
  expect(await t.query(api.pushSubscriptions.getSubscriptions, { babyId })).toEqual([]);

  // A transient failure must NOT delete the subscription
  await t.mutation(api.pushSubscriptions.subscribe, {
    babyId,
    endpoint: "https://push.example.com/flaky",
    p256dh: "key",
    auth: "auth",
  });
  sendNotificationMock.mockRejectedValueOnce(new Error("Network error"));

  await t.action(
    internal.pushNotifications.sendNotification,
    sendArgs({ notificationId, babyId, publicId, status: "born" }),
  );
  expect(await t.query(api.pushSubscriptions.getSubscriptions, { babyId })).toHaveLength(1);
});
