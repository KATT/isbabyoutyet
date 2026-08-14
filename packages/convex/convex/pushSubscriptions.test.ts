import { convexTest } from "convex-test";
import type { PaginationResult } from "convex/server";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import { modules, registerComponents } from "./test.setup";

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
