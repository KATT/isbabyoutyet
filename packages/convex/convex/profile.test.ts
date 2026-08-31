import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import { backfillUserProfileIsAdminDoc } from "./migrations";
import { modules, registerComponents } from "./test.setup";

type LegacyUserProfile = {
  _id: Doc<"userProfiles">["_id"];
  _creationTime: number;
  userId: string;
  tokenIdentifier: string;
  locale: Doc<"userProfiles">["locale"];
  isAdmin: boolean | undefined;
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
    locale: "en-GB",
    timeZone: "Europe/London",
    isAdmin: false,
  });

  await asAlice.mutation(api.profile.updateLocale, { locale: "es" });
  expect(await asAlice.query(api.profile.get, {})).toEqual({
    locale: "es",
    timeZone: "Europe/London",
    isAdmin: false,
  });

  await asAlice.mutation(api.profile.updateLocale, { locale: "pt-BR" });
  expect(await asAlice.query(api.profile.get, {})).toEqual({
    locale: "pt-BR",
    timeZone: "Europe/London",
    isAdmin: false,
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
    userId: "alice",
    requestedLocale: "French (fr-FR)",
  });
});

test("admin profiles preserve their flag across locale updates", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });
  await t.run(async (ctx) => {
    await ctx.db.insert("userProfiles", {
      userId: "alice",
      tokenIdentifier: "https://convex.test|alice",
      locale: "en-GB",
      isAdmin: true,
    });
  });

  expect(await asAlice.query(api.profile.get, {})).toEqual({
    locale: "en-GB",
    timeZone: "Europe/London",
    isAdmin: true,
  });
  expect(await asAlice.mutation(api.profile.updateLocale, { locale: "sv" })).toEqual({
    locale: "sv",
    timeZone: "Europe/London",
    isAdmin: true,
  });
});

test("locale updates create a missing profile", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  expect(await asAlice.mutation(api.profile.updateLocale, { locale: "es" })).toEqual({
    locale: "es",
    timeZone: "Europe/London",
    isAdmin: false,
  });
  expect(await asAlice.query(api.profile.get, {})).toEqual({
    locale: "es",
    timeZone: "Europe/London",
    isAdmin: false,
  });
});

test("time zone updates are inherited by profile reads", async () => {
  const t = await setup();
  const asAlice = t.withIdentity({ subject: "alice" });

  expect(await asAlice.mutation(api.profile.updateTimeZone, { timeZone: "Asia/Tokyo" })).toEqual({
    locale: "en-GB",
    timeZone: "Asia/Tokyo",
    isAdmin: false,
  });
  expect(await asAlice.query(api.profile.get, {})).toEqual({
    locale: "en-GB",
    timeZone: "Asia/Tokyo",
    isAdmin: false,
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
    locale: "sv",
    timeZone: "America/New_York",
    isAdmin: false,
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
      userId: "already-admin",
      tokenIdentifier: "https://convex.test|already-admin",
      locale: "en-GB",
      isAdmin: true,
    });
    const nonAdmin = await ctx.db.insert("userProfiles", {
      userId: "already-false",
      tokenIdentifier: "https://convex.test|already-false",
      locale: "sv",
      isAdmin: false,
    });
    return { admin, nonAdmin };
  });

  await t.run(async (ctx) => {
    const admin = await ctx.db.get(ids.admin);
    const nonAdmin = await ctx.db.get(ids.nonAdmin);
    if (!admin || !nonAdmin) throw new Error("missing profiles");
    await backfillUserProfileIsAdminDoc(ctx, admin);
    await backfillUserProfileIsAdminDoc(ctx, nonAdmin);

    // Simulate a pre-migration document shape for the helper.
    const legacy = { ...nonAdmin } as LegacyUserProfile;
    delete legacy.isAdmin;
    await backfillUserProfileIsAdminDoc(ctx, legacy as typeof nonAdmin);
  });

  await t.run(async (ctx) => {
    expect(await ctx.db.get(ids.admin)).toMatchObject({ isAdmin: true });
    expect(await ctx.db.get(ids.nonAdmin)).toMatchObject({ isAdmin: false });
  });
});
