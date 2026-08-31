import { convexTest } from "convex-test";
import type { PaginationResult } from "convex/server";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import { modules, registerComponents } from "./test.setup";

const TEST_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0.0.0 Mobile Safari/537.36";

test("subscription secrets stay internal while managers see the exact count", async () => {
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
    userAgent: TEST_USER_AGENT,
  });

  expect(
    await asAlice.query(api.pushSubscriptions.getSubscriptionCount, {
      babyId: created.babyId,
    }),
  ).toBe(1);
  // Non-managers get a sentinel instead of a throw so the baby route loader
  // can query the count homogeneously for every visitor.
  expect(
    await asBob.query(api.pushSubscriptions.getSubscriptionCount, {
      babyId: created.babyId,
    }),
  ).toBe("forbidden");
  expect(
    await t.query(api.pushSubscriptions.getSubscriptionCount, {
      babyId: created.babyId,
    }),
  ).toBe("forbidden");

  const internalPage = await t.query(internal.pushSubscriptions.getSubscriptionsPage, {
    babyId: created.babyId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(internalPage.page).toMatchObject([
    {
      endpoint: "https://push.example/subscription",
      p256dh: "public-key",
      auth: "private-auth-secret",
      userAgent: TEST_USER_AGENT,
    },
  ]);

  await t.mutation(api.pushSubscriptions.unsubscribe, {
    babyId: created.babyId,
    endpoint: "https://push.example/subscription",
    p256dh: "wrong-key",
    auth: "wrong-secret",
  });
  expect(
    await asAlice.query(api.pushSubscriptions.getSubscriptionCount, {
      babyId: created.babyId,
    }),
  ).toBe(1);

  await t.mutation(api.pushSubscriptions.unsubscribe, {
    babyId: created.babyId,
    endpoint: "https://push.example/subscription",
    p256dh: "public-key",
    auth: "private-auth-secret",
  });
  expect(
    await asAlice.query(api.pushSubscriptions.getSubscriptionCount, {
      babyId: created.babyId,
    }),
  ).toBe(0);
});

test("internal pagination reaches every subscription without a cap", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Popular Push Baby",
    dueDate: "2026-09-01",
  });

  await t.run(async (ctx) => {
    for (let index = 0; index < 205; index += 1) {
      await ctx.db.insert("pushSubscriptions", {
        babyId: created.babyId,
        endpoint: `https://push.example/subscription-${index}`,
        p256dh: `key-${index}`,
        auth: `secret-${index}`,
        createdAt: index,
      });
    }
    await ctx.db.patch(created.babyId, { subscriptionCount: 205 });
  });

  let cursor: string | null = null;
  let total = 0;
  for (;;) {
    const result: PaginationResult<Doc<"pushSubscriptions">> = await t.query(
      internal.pushSubscriptions.getSubscriptionsPage,
      {
        babyId: created.babyId,
        paginationOpts: { numItems: 100, cursor },
      },
    );
    total += result.page.length;
    if (result.isDone) break;
    cursor = result.continueCursor;
  }

  expect(total).toBe(205);
  expect(
    await asAlice.query(api.pushSubscriptions.getSubscriptionCount, {
      babyId: created.babyId,
    }),
  ).toBe(205);
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
    userAgent: TEST_USER_AGENT,
  };

  const firstId = await t.mutation(api.pushSubscriptions.subscribe, args);
  const secondId = await t.mutation(api.pushSubscriptions.subscribe, {
    ...args,
    p256dh: "rotated-key",
    auth: "rotated-secret",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1",
  });
  expect(secondId).toBe(firstId);
  const rotatedPage = await t.query(internal.pushSubscriptions.getSubscriptionsPage, {
    babyId: created.babyId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(rotatedPage.page).toMatchObject([
    {
      p256dh: "rotated-key",
      auth: "rotated-secret",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1",
    },
  ]);
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

test("managers can opt into message alerts without changing the family subscriber count", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });
  const asBob = t.withIdentity({ subject: "bob" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Owner Push Baby",
    dueDate: "2026-09-01",
  });
  const ownerArgs = {
    babyId: created.babyId,
    endpoint: "https://push.example/owner",
    p256dh: "owner-key",
    auth: "owner-secret",
    userAgent: TEST_USER_AGENT,
  };

  await expect(t.mutation(api.pushSubscriptions.subscribeAsOwner, ownerArgs)).rejects.toThrow(
    "Not authenticated",
  );
  await expect(asBob.mutation(api.pushSubscriptions.subscribeAsOwner, ownerArgs)).rejects.toThrow(
    "Not authorized",
  );

  const subscriptionId = await asAlice.mutation(api.pushSubscriptions.subscribeAsOwner, ownerArgs);
  expect(
    await asAlice.query(api.pushSubscriptions.getSubscriptionCount, {
      babyId: created.babyId,
    }),
  ).toBe(0);
  expect(
    await t.query(api.pushSubscriptions.isOwnerSubscribed, {
      babyId: created.babyId,
      endpoint: ownerArgs.endpoint,
    }),
  ).toBe(true);
  expect(
    await t.query(api.pushSubscriptions.isSubscribed, {
      babyId: created.babyId,
      endpoint: ownerArgs.endpoint,
    }),
  ).toBe(false);

  const familyPage = await t.query(internal.pushSubscriptions.getSubscriptionsPage, {
    babyId: created.babyId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(familyPage.page).toEqual([]);
  const ownerPage = await t.query(internal.pushSubscriptions.getOwnerSubscriptionsPage, {
    babyId: created.babyId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(ownerPage.page).toMatchObject([{ _id: subscriptionId, endpoint: ownerArgs.endpoint }]);

  const rotatedId = await asAlice.mutation(api.pushSubscriptions.subscribeAsOwner, {
    ...ownerArgs,
    p256dh: "rotated-owner-key",
    auth: "rotated-owner-secret",
  });
  expect(rotatedId).toBe(subscriptionId);
  const rotatedOwnerPage = await t.query(internal.pushSubscriptions.getOwnerSubscriptionsPage, {
    babyId: created.babyId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(rotatedOwnerPage.page).toMatchObject([
    { p256dh: "rotated-owner-key", auth: "rotated-owner-secret" },
  ]);

  await asAlice.mutation(api.pushSubscriptions.unsubscribeAsOwner, {
    babyId: created.babyId,
    endpoint: ownerArgs.endpoint,
    p256dh: "wrong-key",
    auth: "wrong-secret",
  });
  expect(
    await t.query(api.pushSubscriptions.isOwnerSubscribed, {
      babyId: created.babyId,
      endpoint: ownerArgs.endpoint,
    }),
  ).toBe(true);

  await asAlice.mutation(api.pushSubscriptions.unsubscribeAsOwner, {
    babyId: created.babyId,
    endpoint: ownerArgs.endpoint,
    p256dh: "rotated-owner-key",
    auth: "rotated-owner-secret",
  });
  expect(
    await t.query(api.pushSubscriptions.isOwnerSubscribed, {
      babyId: created.babyId,
      endpoint: ownerArgs.endpoint,
    }),
  ).toBe(false);
  expect(
    await t.query(api.pushSubscriptions.isOwnerSubscribed, {
      babyId: created.publicId,
      endpoint: ownerArgs.endpoint,
    }),
  ).toBe(false);
  expect(
    await t.query(api.pushSubscriptions.isOwnerSubscribed, {
      babyId: "missing-baby",
      endpoint: ownerArgs.endpoint,
    }),
  ).toBe(false);
});

test("removeByEndpoint clears owner message subscriptions for that browser", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Owner Endpoint Baby",
    dueDate: "2026-09-01",
  });
  await asAlice.mutation(api.pushSubscriptions.subscribeAsOwner, {
    babyId: created.babyId,
    endpoint: "https://push.example/shared-endpoint",
    p256dh: "owner-key",
    auth: "owner-secret",
    userAgent: TEST_USER_AGENT,
  });

  await t.mutation(internal.pushSubscriptions.removeByEndpoint, {
    endpoint: "https://push.example/shared-endpoint",
  });
  expect(
    await t.query(api.pushSubscriptions.isOwnerSubscribed, {
      babyId: created.babyId,
      endpoint: "https://push.example/shared-endpoint",
    }),
  ).toBe(false);
});
