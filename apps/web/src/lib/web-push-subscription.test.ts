import { expect, test } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { ensureWebPushSubscription, readWebPushSubscription } from "./web-push-subscription";

const VAPID_PUBLIC_KEY = btoa("test-vapid-public-key");
const ENDPOINT = "https://push.example/owner";

function pushSubscription(opts: { keys: { p256dh: string; auth: string } | null }) {
  return {
    endpoint: ENDPOINT,
    toJSON: () =>
      opts.keys ? { endpoint: ENDPOINT, keys: opts.keys } : { endpoint: ENDPOINT, keys: undefined },
  } as unknown as PushSubscription;
}

function stubPushEnvironment(opts: {
  permission: NotificationPermission;
  requestPermissionResult: NotificationPermission | null;
  existing: PushSubscription | null;
  next: PushSubscription | null;
}) {
  const restore: Array<() => void> = [];
  let current = opts.existing;

  function replaceProperty<$Target extends object>(
    target: $Target,
    property: { key: string; descriptor: PropertyDescriptor },
  ) {
    const existing = Object.getOwnPropertyDescriptor(target, property.key);
    Object.defineProperty(target, property.key, { configurable: true, ...property.descriptor });
    restore.push(() => {
      if (existing) {
        Object.defineProperty(target, property.key, existing);
        return;
      }
      Reflect.deleteProperty(target, property.key);
    });
  }

  const NotificationStub = function Notification() {} as unknown as typeof Notification;
  Object.defineProperty(NotificationStub, "permission", {
    configurable: true,
    get: () => opts.permission,
  });
  NotificationStub.requestPermission = () => {
    if (!opts.requestPermissionResult) {
      throw new Error("requestPermission should not run");
    }
    return Promise.resolve(opts.requestPermissionResult);
  };
  replaceProperty(globalThis, {
    key: "Notification",
    descriptor: { value: NotificationStub },
  });

  const registration = {
    pushManager: {
      getSubscription: () => Promise.resolve(current),
      subscribe: () => {
        current = opts.next;
        return Promise.resolve(current);
      },
    },
  } as ServiceWorkerRegistration;
  replaceProperty(navigator, {
    key: "serviceWorker",
    descriptor: { value: { ready: Promise.resolve(registration) } },
  });

  return makeResource(registration.pushManager, () => {
    for (const fn of restore.toReversed()) {
      fn();
    }
  });
}

test("readWebPushSubscription returns null when the browser has no push subscription", async () => {
  await using _env = stubPushEnvironment({
    permission: "granted",
    requestPermissionResult: null,
    existing: null,
    next: null,
  });

  expect(await readWebPushSubscription()).toBeNull();
});

test("readWebPushSubscription returns keys from the current browser subscription", async () => {
  await using _env = stubPushEnvironment({
    permission: "granted",
    requestPermissionResult: null,
    existing: pushSubscription({ keys: { p256dh: "p256", auth: "auth" } }),
    next: null,
  });

  expect(await readWebPushSubscription()).toEqual({
    endpoint: ENDPOINT,
    p256dh: "p256",
    auth: "auth",
  });
});

test("readWebPushSubscription returns null when the subscription JSON is incomplete", async () => {
  await using _env = stubPushEnvironment({
    permission: "granted",
    requestPermissionResult: null,
    existing: pushSubscription({ keys: null }),
    next: null,
  });

  expect(await readWebPushSubscription()).toBeNull();
});

test("ensureWebPushSubscription reuses a valid existing subscription", async () => {
  await using _env = stubPushEnvironment({
    permission: "granted",
    requestPermissionResult: null,
    existing: pushSubscription({ keys: { p256dh: "p256", auth: "auth" } }),
    next: null,
  });

  expect(await ensureWebPushSubscription(VAPID_PUBLIC_KEY)).toEqual({
    endpoint: ENDPOINT,
    p256dh: "p256",
    auth: "auth",
  });
});

test("ensureWebPushSubscription subscribes when permission is already granted", async () => {
  await using _env = stubPushEnvironment({
    permission: "granted",
    requestPermissionResult: null,
    existing: null,
    next: pushSubscription({ keys: { p256dh: "p256", auth: "auth" } }),
  });

  expect(await ensureWebPushSubscription(VAPID_PUBLIC_KEY)).toEqual({
    endpoint: ENDPOINT,
    p256dh: "p256",
    auth: "auth",
  });
});

test("ensureWebPushSubscription requests permission when it is still default", async () => {
  await using _env = stubPushEnvironment({
    permission: "default",
    requestPermissionResult: "granted",
    existing: null,
    next: pushSubscription({ keys: { p256dh: "p256", auth: "auth" } }),
  });

  expect(await ensureWebPushSubscription(VAPID_PUBLIC_KEY)).toEqual({
    endpoint: ENDPOINT,
    p256dh: "p256",
    auth: "auth",
  });
});

test("ensureWebPushSubscription throws when the permission prompt is denied", async () => {
  await using _env = stubPushEnvironment({
    permission: "default",
    requestPermissionResult: "denied",
    existing: null,
    next: null,
  });

  await expect(ensureWebPushSubscription(VAPID_PUBLIC_KEY)).rejects.toThrow(
    "Notification permission denied",
  );
});

test("ensureWebPushSubscription throws when notifications are already blocked", async () => {
  await using _env = stubPushEnvironment({
    permission: "denied",
    requestPermissionResult: null,
    existing: null,
    next: null,
  });

  await expect(ensureWebPushSubscription(VAPID_PUBLIC_KEY)).rejects.toThrow(
    "Notification permission is required",
  );
});

test("ensureWebPushSubscription resubscribes when the existing subscription lacks keys", async () => {
  await using _env = stubPushEnvironment({
    permission: "granted",
    requestPermissionResult: null,
    existing: pushSubscription({ keys: null }),
    next: pushSubscription({ keys: { p256dh: "fresh", auth: "fresh-auth" } }),
  });

  expect(await ensureWebPushSubscription(VAPID_PUBLIC_KEY)).toEqual({
    endpoint: ENDPOINT,
    p256dh: "fresh",
    auth: "fresh-auth",
  });
});

test("ensureWebPushSubscription throws when the new subscription lacks keys", async () => {
  await using _env = stubPushEnvironment({
    permission: "granted",
    requestPermissionResult: null,
    existing: null,
    next: pushSubscription({ keys: null }),
  });

  await expect(ensureWebPushSubscription(VAPID_PUBLIC_KEY)).rejects.toThrow(
    "Failed to get subscription data",
  );
});
