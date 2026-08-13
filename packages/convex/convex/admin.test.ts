import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";
import { DEMO_USER, HOMEPAGE_DEMO_OWNER_USER_ID } from "../src/seedCredentials";
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

  await expect(asAlice.query(api.admin.listLanguageRequests, {})).rejects.toThrow("Not authorized");
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
    // Soft-deleted co-parent and duplicate owner email must not appear twice.
    await ctx.db.insert("babyCoParents", {
      babyId: waiting._id,
      userId: "gone-user",
      email: "gone@example.com",
      name: "Gone",
      addedByUserId: seeded.userId,
      addedAt: Date.now(),
      deletedAt: Date.now(),
    });
    await ctx.db.insert("babyCoParents", {
      babyId: waiting._id,
      userId: "dup-owner",
      email: DEMO_USER.email,
      name: "Dup",
      addedByUserId: seeded.userId,
      addedAt: Date.now(),
    });
    // Soft-deleted baby is omitted from the admin list.
    await ctx.db.insert("baby", {
      userId: "unknown-owner",
      name: "Deleted",
      dueDate: "2026-12-01",
      publicId: "baby-deleted",
      deletedAt: Date.now(),
    });
    // Baby with no timeline activity falls back to createdAt for updatedAt.
    await ctx.db.insert("baby", {
      userId: "unknown-owner",
      name: "Quiet",
      dueDate: "2026-12-01",
      publicId: "baby-quiet",
    });
    // Homepage live demos use a sentinel owner that is not a Better Auth document
    // id — looking it up must not crash the admin list.
    await ctx.db.insert("baby", {
      userId: HOMEPAGE_DEMO_OWNER_USER_ID,
      name: "Juniper Hale",
      dueDate: "2026-08-01",
      publicId: "juniper-hale",
      demo: true,
    });
  });

  const byCreated = await asDemo.query(api.admin.listBabies, { sortBy: "created" });
  expect(byCreated.some((row) => row.publicId === "baby-deleted")).toBe(false);
  expect(byCreated.some((row) => row.publicId === "baby-quiet")).toBe(true);
  const juniper = byCreated.find((row) => row.publicId === "juniper-hale");
  expect(juniper).toMatchObject({ demo: true, managerEmails: [] });
  for (let i = 1; i < byCreated.length; i++) {
    expect(byCreated[i - 1]!.createdAt).toBeGreaterThanOrEqual(byCreated[i]!.createdAt);
  }

  const waitingRow = byCreated.find((row) => row.publicId === "baby-waiting");
  expect(waitingRow?.managerEmails).toEqual([DEMO_USER.email, "coparent@example.com"]);

  const quiet = byCreated.find((row) => row.publicId === "baby-quiet");
  expect(quiet?.updatedAt).toBe(quiet?.createdAt);
  expect(quiet?.managerEmails).toEqual([]);

  const byUpdated = await asDemo.query(api.admin.listBabies, { sortBy: "updated" });
  expect(byUpdated.length).toBe(byCreated.length);
  for (let i = 1; i < byUpdated.length; i++) {
    expect(byUpdated[i - 1]!.updatedAt).toBeGreaterThanOrEqual(byUpdated[i]!.updatedAt);
  }

  // Language request email cache: two requests from the same known user.
  const asDemoRequester = t.withIdentity({ subject: seeded.userId });
  await asDemoRequester.mutation(api.profile.requestLanguage, { requestedLocale: "Welsh" });
  await asDemoRequester.mutation(api.profile.requestLanguage, { requestedLocale: "Irish" });
  const requests = await asDemo.query(api.admin.listLanguageRequests, {});
  expect(requests.filter((row) => row.userEmail === DEMO_USER.email).length).toBe(2);

  const authUser = await t.query(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", value: DEMO_USER.email }],
  });
  expect(authUser).toBeTruthy();
});
