import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { createAuth } from "./auth";
import { localeFromAcceptLanguage } from "./profileBootstrap";
import { modules, registerComponents } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  return t;
}

test("localeFromAcceptLanguage picks the first supported tag", () => {
  expect(localeFromAcceptLanguage("sv-SE,en;q=0.9")).toBe("sv");
  expect(localeFromAcceptLanguage("fr-FR,en;q=0.9")).toBe("en-GB");
});

test("sign-up creates a profile from Accept-Language", async () => {
  const t = await setup();
  const userId = await t.run(async (ctx) => {
    const auth = createAuth(ctx);
    const result = await auth.api.signUpEmail({
      body: {
        email: "locale@example.com",
        name: "Locale User",
        password: "password123",
      },
      headers: {
        "accept-language": "sv-SE,en;q=0.9",
        "x-time-zone": "Asia/Tokyo",
      },
    });
    return result.user.id;
  });

  const asUser = t.withIdentity({ subject: userId });
  expect(await asUser.query(api.profile.get, {})).toEqual({
    isAdmin: false,
    locale: "sv",
    timeZone: "Asia/Tokyo",
  });
});

test("sign-in ensures a profile exists for legacy users", async () => {
  const t = await setup();
  const userId = await t.run(async (ctx) => {
    const auth = createAuth(ctx);
    const result = await auth.api.signUpEmail({
      body: {
        email: "legacy@example.com",
        name: "Legacy",
        password: "password123",
      },
    });
    return result.user.id;
  });

  await t.run(async (ctx) => {
    const tokenIdentifier = `https://convex.test|${userId}`;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    if (!profile) {
      throw new Error("expected sign-up profile");
    }
    await ctx.db.delete(profile._id);
  });

  await t.run(async (ctx) => {
    const auth = createAuth(ctx);
    await auth.api.signInEmail({
      body: {
        email: "legacy@example.com",
        password: "password123",
      },
      headers: {
        "accept-language": "es-MX",
        "x-time-zone": "America/New_York",
      },
    });
  });

  const asUser = t.withIdentity({ subject: userId });
  expect(await asUser.query(api.profile.get, {})).toEqual({
    isAdmin: false,
    locale: "es",
    timeZone: "America/New_York",
  });
});

test("sign-in fills a missing time zone without replacing the saved language", async () => {
  const t = await setup();
  const userId = await t.run(async (ctx) => {
    const auth = createAuth(ctx);
    const result = await auth.api.signUpEmail({
      body: {
        email: "missing-time-zone@example.com",
        name: "Missing Time Zone",
        password: "password123",
      },
      headers: {
        "accept-language": "sv-SE",
      },
    });
    return result.user.id;
  });

  await t.run(async (ctx) => {
    const tokenIdentifier = `https://convex.test|${userId}`;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    if (!profile) {
      throw new Error("expected sign-up profile");
    }
    await ctx.db.replace("userProfiles", profile._id, {
      isAdmin: profile.isAdmin,
      locale: profile.locale,
      tokenIdentifier: profile.tokenIdentifier,
      userId: profile.userId,
    });
  });

  await t.run(async (ctx) => {
    const auth = createAuth(ctx);
    await auth.api.signInEmail({
      body: {
        email: "missing-time-zone@example.com",
        password: "password123",
      },
      headers: {
        "accept-language": "es-MX",
        "x-time-zone": "Asia/Tokyo",
      },
    });
  });

  expect(await t.withIdentity({ subject: userId }).query(api.profile.get, {})).toEqual({
    isAdmin: false,
    locale: "sv",
    timeZone: "Asia/Tokyo",
  });
});

test("sign-in does not replace saved browser preferences", async () => {
  const t = await setup();
  const userId = await t.run(async (ctx) => {
    const auth = createAuth(ctx);
    const result = await auth.api.signUpEmail({
      body: {
        email: "saved-preferences@example.com",
        name: "Saved Preferences",
        password: "password123",
      },
      headers: {
        "accept-language": "sv-SE",
        "x-time-zone": "Asia/Tokyo",
      },
    });
    return result.user.id;
  });

  await t.run(async (ctx) => {
    const auth = createAuth(ctx);
    await auth.api.signInEmail({
      body: {
        email: "saved-preferences@example.com",
        password: "password123",
      },
      headers: {
        "accept-language": "es-MX",
        "x-time-zone": "America/New_York",
      },
    });
  });

  expect(await t.withIdentity({ subject: userId }).query(api.profile.get, {})).toEqual({
    isAdmin: false,
    locale: "sv",
    timeZone: "Asia/Tokyo",
  });
});
