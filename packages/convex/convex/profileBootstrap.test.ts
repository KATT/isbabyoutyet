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
        password: "password123",
        name: "Locale User",
      },
      headers: {
        "accept-language": "sv-SE,en;q=0.9",
      },
    });
    return result.user.id;
  });

  const asUser = t.withIdentity({ subject: userId });
  expect(await asUser.query(api.profile.get, {})).toEqual({
    locale: "sv",
    timeZone: "Europe/London",
    isAdmin: false,
  });
});

test("sign-in ensures a profile exists for legacy users", async () => {
  const t = await setup();
  const userId = await t.run(async (ctx) => {
    const auth = createAuth(ctx);
    const result = await auth.api.signUpEmail({
      body: {
        email: "legacy@example.com",
        password: "password123",
        name: "Legacy",
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
      },
    });
  });

  const asUser = t.withIdentity({ subject: userId });
  expect(await asUser.query(api.profile.get, {})).toEqual({
    locale: "es",
    timeZone: "Europe/London",
    isAdmin: false,
  });
});
