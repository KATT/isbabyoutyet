import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { makeResource } from "./test.resource";
import { modules, registerComponents } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby",
    dueDate: "2026-09-01",
  });
  return { t, babyId: created.babyId };
}

const SUBSCRIPTION = {
  endpoint: "https://push.example.com/sub-1",
  p256dh: "p256dh-key",
  auth: "auth-key",
};

test("subscribe creates a subscription and updates it on re-subscribe", async () => {
  const { t, babyId } = await setup();

  const firstId = await t.mutation(api.pushSubscriptions.subscribe, { babyId, ...SUBSCRIPTION });

  // Re-subscribing with the same endpoint updates the keys instead of duplicating
  const secondId = await t.mutation(api.pushSubscriptions.subscribe, {
    babyId,
    endpoint: SUBSCRIPTION.endpoint,
    p256dh: "rotated-p256dh",
    auth: "rotated-auth",
  });
  expect(secondId).toBe(firstId);

  const subscriptions = await t.query(api.pushSubscriptions.getSubscriptions, { babyId });
  expect(subscriptions).toMatchObject([
    { endpoint: SUBSCRIPTION.endpoint, p256dh: "rotated-p256dh", auth: "rotated-auth" },
  ]);
});

test("isSubscribed reflects subscribe and unsubscribe", async () => {
  const { t, babyId } = await setup();

  const check = () =>
    t.query(api.pushSubscriptions.isSubscribed, { babyId, endpoint: SUBSCRIPTION.endpoint });

  expect(await check()).toBe(false);

  await t.mutation(api.pushSubscriptions.subscribe, { babyId, ...SUBSCRIPTION });
  expect(await check()).toBe(true);

  await t.mutation(api.pushSubscriptions.unsubscribe, { endpoint: SUBSCRIPTION.endpoint });
  expect(await check()).toBe(false);

  // Unsubscribing an unknown endpoint is a no-op
  await t.mutation(api.pushSubscriptions.unsubscribe, { endpoint: "https://unknown.example.com" });
});

test("getPublicKey returns the VAPID public key from the environment", async () => {
  await using _env = makeResource({}, () => {
    vi.unstubAllEnvs();
  });

  const { t } = await setup();

  vi.stubEnv("VAPID_PUBLIC_KEY", "test-public-key");
  expect(await t.query(api.pushSubscriptions.getPublicKey, {})).toBe("test-public-key");

  vi.stubEnv("VAPID_PUBLIC_KEY", "");
  await expect(t.query(api.pushSubscriptions.getPublicKey, {})).rejects.toThrow(
    "VAPID_PUBLIC_KEY environment variable is not set",
  );
});
