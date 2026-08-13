import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";
import { DEMO_USER } from "../src/seedCredentials";
import { modules, registerComponents } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  return t;
}

test("admin queries refuse non-admins and anonymous callers", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });
  await asAlice.mutation(api.profile.ensure, { browserLocale: "en-GB" });

  await expect(asAlice.query(api.admin.listLanguageRequests, {})).rejects.toThrow(
    "Not authorized",
  );
  await expect(asAlice.query(api.admin.listBabies, { sortBy: "created" })).rejects.toThrow(
    "Not authorized",
  );
  await expect(t.query(api.admin.listLanguageRequests, {})).rejects.toThrow("Not authenticated");
});

test("seedDemoData marks the demo user as admin", async () => {
  const t = await setup();
  const seeded = await t.mutation(internal.seed.seedDemoData, {});
  const asDemo = t.withIdentity({ subject: seeded.userId });

  expect(await asDemo.query(api.profile.get, {})).toMatchObject({
    locale: "en-GB",
    isAdmin: true,
  });

  // Idempotent re-seed still leaves the admin flag set.
  await t.mutation(internal.seed.seedDemoData, {});
  expect(await asDemo.query(api.profile.get, {})).toMatchObject({ isAdmin: true });
});

test("admins can list language requests with requester emails", async () => {
  const t = await setup();
  const seeded = await t.mutation(internal.seed.seedDemoData, {});
  const asDemo = t.withIdentity({ subject: seeded.userId });

  const asBob = t.withIdentity({ subject: "bob" });
  await asBob.mutation(api.profile.ensure, { browserLocale: "en-GB" });
  await asBob.mutation(api.profile.requestLanguage, { requestedLocale: "French" });

  const requests = await asDemo.query(api.admin.listLanguageRequests, {});
  expect(requests).toEqual([
    expect.objectContaining({
      requestedLocale: "French",
      userId: "bob",
      userEmail: null,
    }),
  ]);
});

test("admins can list babies sorted by created or updated with manager emails", async () => {
  const t = await setup();
  const seeded = await t.mutation(internal.seed.seedDemoData, {});
  const asDemo = t.withIdentity({ subject: seeded.userId });

  // Add a co-parent so manager emails include more than the owner.
  const waiting = await t.run(async (ctx) => {
    return await ctx.db
      .query("baby")
      .withIndex("by_publicId", (q) => q.eq("publicId", "baby-waiting"))
      .unique();
  });
  if (!waiting) throw new Error("missing waiting baby");

  await t.run(async (ctx) => {
    await ctx.db.insert("babyCoParents", {
      babyId: waiting._id,
      userId: "co-parent-user",
      email: "coparent@example.com",
      name: "Co",
      addedByUserId: seeded.userId,
      addedAt: Date.now(),
    });
  });

  const byCreated = await asDemo.query(api.admin.listBabies, { sortBy: "created" });
  expect(byCreated.length).toBeGreaterThanOrEqual(4);
  for (let i = 1; i < byCreated.length; i++) {
    expect(byCreated[i - 1]!.createdAt).toBeGreaterThanOrEqual(byCreated[i]!.createdAt);
  }

  const waitingRow = byCreated.find((row) => row.publicId === "baby-waiting");
  expect(waitingRow?.managerEmails).toEqual(
    expect.arrayContaining([DEMO_USER.email, "coparent@example.com"]),
  );

  const byUpdated = await asDemo.query(api.admin.listBabies, { sortBy: "updated" });
  expect(byUpdated.length).toBe(byCreated.length);
  for (let i = 1; i < byUpdated.length; i++) {
    expect(byUpdated[i - 1]!.updatedAt).toBeGreaterThanOrEqual(byUpdated[i]!.updatedAt);
  }

  // Sanity: Better Auth user email resolved for the demo owner.
  const authUser = await t.query(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", value: DEMO_USER.email }],
  });
  expect(authUser).toBeTruthy();
});
