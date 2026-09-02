import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import { backfillUserProfileIsAdminDoc } from "./migrations";
import { modules, registerComponents } from "./test.setup";

/** Pre-migration row: `isAdmin` is `| undefined` so deleting it is a known field, not a widened bag. */
type LegacyUserProfile = {
  _creationTime: number;
  _id: Doc<"userProfiles">["_id"];
  isAdmin: boolean | undefined;
  locale: Doc<"userProfiles">["locale"];
  tokenIdentifier: string;
  userId: string;
};

async function setup() {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  return t;
}

test("a missing authenticated profile defaults to British English", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  expect(await asAlice.query(api.profile.get, {})).toEqual({
    isAdmin: false,
    locale: "en-GB",
    timeZone: "Europe/London",
  });

  await asAlice.mutation(api.profile.updateLocale, { locale: "es" });
  expect(await asAlice.query(api.profile.get, {})).toEqual({
    isAdmin: false,
    locale: "es",
    timeZone: "Europe/London",
  });

  await asAlice.mutation(api.profile.updateLocale, { locale: "pt-BR" });
  expect(await asAlice.query(api.profile.get, {})).toEqual({
    isAdmin: false,
    locale: "pt-BR",
    timeZone: "Europe/London",
  });
});

test("anonymous callers have no profile", async () => {
  const t = await setup();

  expect(await t.query(api.profile.get, {})).toBeNull();
});

test("language requests are stored for authenticated users", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  const requestId = await asAlice.mutation(api.profile.requestLanguage, {
    requestedLocale: "French (fr-FR)",
  });
  const request = await t.run((ctx) => ctx.db.get(requestId));
  expect(request).toMatchObject({
    requestedLocale: "French (fr-FR)",
    userId: "alice",
  });
});

test("admin profiles preserve their flag across locale updates", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });
  await t.run(async (ctx) => {
    await ctx.db.insert("userProfiles", {
      isAdmin: true,
      locale: "en-GB",
      tokenIdentifier: "https://convex.test|alice",
      userId: "alice",
    });
  });

  expect(await asAlice.query(api.profile.get, {})).toEqual({
    isAdmin: true,
    locale: "en-GB",
    timeZone: "Europe/London",
  });
  expect(await asAlice.mutation(api.profile.updateLocale, { locale: "sv" })).toEqual({
    isAdmin: true,
    locale: "sv",
    timeZone: "Europe/London",
  });
});

test("locale updates create a missing profile", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  expect(await asAlice.mutation(api.profile.updateLocale, { locale: "es" })).toEqual({
    isAdmin: false,
    locale: "es",
    timeZone: "Europe/London",
  });
  expect(await asAlice.query(api.profile.get, {})).toEqual({
    isAdmin: false,
    locale: "es",
    timeZone: "Europe/London",
  });
});

test("time zone updates are inherited by profile reads", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  expect(await asAlice.mutation(api.profile.updateTimeZone, { timeZone: "Asia/Tokyo" })).toEqual({
    isAdmin: false,
    locale: "en-GB",
    timeZone: "Asia/Tokyo",
  });
  expect(await asAlice.query(api.profile.get, {})).toEqual({
    isAdmin: false,
    locale: "en-GB",
    timeZone: "Asia/Tokyo",
  });
  await expect(
    asAlice.mutation(api.profile.updateTimeZone, { timeZone: "Not/A_Time_Zone" }),
  ).rejects.toThrow("Choose a valid time zone");
});

test("time zone updates preserve an existing profile's locale", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });
  await asAlice.mutation(api.profile.updateLocale, { locale: "sv" });

  expect(
    await asAlice.mutation(api.profile.updateTimeZone, { timeZone: "America/New_York" }),
  ).toEqual({
    isAdmin: false,
    locale: "sv",
    timeZone: "America/New_York",
  });
});

test("language requests enforce their length bounds", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  await expect(
    asAlice.mutation(api.profile.requestLanguage, { requestedLocale: "x" }),
  ).rejects.toThrow("Enter a language name or language code");
  await expect(
    asAlice.mutation(api.profile.requestLanguage, { requestedLocale: "x".repeat(101) }),
  ).rejects.toThrow("Enter a language name or language code");
});

test("profile mutations require authentication", async () => {
  const t = await setup();

  await expect(t.mutation(api.profile.updateLocale, { locale: "es" })).rejects.toThrow(
    "Not authenticated",
  );
  await expect(
    t.mutation(api.profile.updateTimeZone, { timeZone: "Europe/London" }),
  ).rejects.toThrow("Not authenticated");
});

test("backfillUserProfileIsAdmin fills missing isAdmin and leaves set values alone", async () => {
  const t = await setup();
  const ids = await t.run(async (ctx) => {
    const admin = await ctx.db.insert("userProfiles", {
      isAdmin: true,
      locale: "en-GB",
      tokenIdentifier: "https://convex.test|already-admin",
      userId: "already-admin",
    });
    const nonAdmin = await ctx.db.insert("userProfiles", {
      isAdmin: false,
      locale: "sv",
      tokenIdentifier: "https://convex.test|already-false",
      userId: "already-false",
    });
    return { admin, nonAdmin };
  });

  await t.run(async (ctx) => {
    const admin = await ctx.db.get(ids.admin);
    const nonAdmin = await ctx.db.get(ids.nonAdmin);
    if (!admin || !nonAdmin) {
      throw new Error("missing profiles");
    }
    await backfillUserProfileIsAdminDoc(ctx, admin);
    await backfillUserProfileIsAdminDoc(ctx, nonAdmin);

    // Simulate a pre-migration document shape for the helper.
    const legacy: LegacyUserProfile = { ...nonAdmin };
    delete legacy.isAdmin;
    // SAFETY: Mock constructor is installed in place of the browser global.
    await backfillUserProfileIsAdminDoc(ctx, legacy as typeof nonAdmin);
  });

  await t.run(async (ctx) => {
    expect(await ctx.db.get(ids.admin)).toMatchObject({ isAdmin: true });
    expect(await ctx.db.get(ids.nonAdmin)).toMatchObject({ isAdmin: false });
  });
});
