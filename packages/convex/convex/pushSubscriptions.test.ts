import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules, registerComponents } from "./test.setup";

test("subscription secrets stay internal while managers can detect subscribers", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });
  const asBob = t.withIdentity({ subject: "bob" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Push Baby",
    dueDate: "2026-09-01",
  });

  await t.mutation(api.pushSubscriptions.subscribe, {
    babyId: created.babyId,
    endpoint: "https://push.example/subscription",
    p256dh: "public-key",
    auth: "private-auth-secret",
  });

  expect(
    await asAlice.query(api.pushSubscriptions.hasSubscriptions, {
      babyId: created.babyId,
    }),
  ).toBe(true);
  await expect(
    asBob.query(api.pushSubscriptions.hasSubscriptions, {
      babyId: created.babyId,
    }),
  ).rejects.toThrow("Not authorized");
  await expect(
    t.query(api.pushSubscriptions.hasSubscriptions, {
      babyId: created.babyId,
    }),
  ).rejects.toThrow("Not authenticated");

  const internalPage = await t.query(internal.pushSubscriptions.getSubscriptionsPage, {
    babyId: created.babyId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(internalPage.page).toMatchObject([
    {
      endpoint: "https://push.example/subscription",
      p256dh: "public-key",
      auth: "private-auth-secret",
    },
  ]);

  await t.mutation(api.pushSubscriptions.unsubscribe, {
    babyId: created.babyId,
    endpoint: "https://push.example/subscription",
    p256dh: "wrong-key",
    auth: "wrong-secret",
  });
  expect(
    await asAlice.query(api.pushSubscriptions.hasSubscriptions, {
      babyId: created.babyId,
    }),
  ).toBe(true);

  await t.mutation(api.pushSubscriptions.unsubscribe, {
    babyId: created.babyId,
    endpoint: "https://push.example/subscription",
    p256dh: "public-key",
    auth: "private-auth-secret",
  });
  expect(
    await asAlice.query(api.pushSubscriptions.hasSubscriptions, {
      babyId: created.babyId,
    }),
  ).toBe(false);
});

test("resubscribe rotates credentials and deleted babies reject new subscriptions", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Rotating Push Baby",
    dueDate: "2026-09-01",
  });
  const args = {
    babyId: created.babyId,
    endpoint: "https://push.example/rotating",
    p256dh: "first-key",
    auth: "first-secret",
  };

  const firstId = await t.mutation(api.pushSubscriptions.subscribe, args);
  const secondId = await t.mutation(api.pushSubscriptions.subscribe, {
    ...args,
    p256dh: "rotated-key",
    auth: "rotated-secret",
  });
  expect(secondId).toBe(firstId);
  expect(
    await t.query(api.pushSubscriptions.isSubscribed, {
      babyId: created.babyId,
      endpoint: args.endpoint,
    }),
  ).toBe(true);
  expect(
    await t.query(api.pushSubscriptions.isSubscribed, {
      babyId: created.babyId,
      endpoint: "https://push.example/missing",
    }),
  ).toBe(false);

  await t.mutation(internal.pushSubscriptions.removeByEndpoint, {
    endpoint: args.endpoint,
  });
  expect(
    await t.query(api.pushSubscriptions.isSubscribed, {
      babyId: created.babyId,
      endpoint: args.endpoint,
    }),
  ).toBe(false);

  await asAlice.mutation(api.baby.remove, { babyId: created.babyId });
  await expect(
    t.mutation(api.pushSubscriptions.subscribe, {
      ...args,
      endpoint: "https://push.example/deleted",
    }),
  ).rejects.toThrow("Baby not found");
});
