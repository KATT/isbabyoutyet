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
});
