import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { DEFAULT_LOCALE, resolveSupportedLocale } from "../src/i18n";
import { DEFAULT_TIME_ZONE, isValidTimeZone, resolveTimeZone } from "../src/timeZone";
import { supportedLocaleValidator } from "./i18n";
import { appIdentity } from "./authIdentity";
import { mutationWithTriggers } from "./triggers";

const profileResultValidator = v.object({
  locale: supportedLocaleValidator,
  timeZone: v.string(),
  isAdmin: v.boolean(),
});

async function requireIdentity(ctx: Pick<QueryCtx, "auth">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

async function getProfileHandler(ctx: Pick<QueryCtx, "db">, tokenIdentifier: string) {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
}

function toProfileResult(profile: { locale: string; timeZone: string; isAdmin: boolean }) {
  return {
    locale: resolveSupportedLocale(profile.locale),
    timeZone: resolveTimeZone(profile.timeZone),
    isAdmin: profile.isAdmin,
  };
}

export const get = query({
  args: {},
  returns: v.union(profileResultValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const caller = appIdentity(identity);
    const profile = await getProfileHandler(ctx, caller.tokenIdentifier);
    return profile
      ? toProfileResult(profile)
      : { locale: DEFAULT_LOCALE, timeZone: DEFAULT_TIME_ZONE, isAdmin: false };
  },
});

export const updateLocale = mutationWithTriggers({
  args: {
    locale: supportedLocaleValidator,
  },
  returns: profileResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const caller = appIdentity(identity);
    const existing = await getProfileHandler(ctx, caller.tokenIdentifier);
    if (existing) {
      await ctx.db.patch(existing._id, {
        locale: args.locale,
        tokenIdentifier: caller.tokenIdentifier,
      });
      return {
        locale: args.locale,
        timeZone: resolveTimeZone(existing.timeZone),
        isAdmin: existing.isAdmin,
      };
    }
    await ctx.db.insert("userProfiles", {
      userId: caller.authUserId,
      tokenIdentifier: caller.tokenIdentifier,
      locale: args.locale,
      timeZone: DEFAULT_TIME_ZONE,
      isAdmin: false,
    });
    return { locale: args.locale, timeZone: DEFAULT_TIME_ZONE, isAdmin: false };
  },
});

export const updateTimeZone = mutation({
  args: {
    timeZone: v.string(),
  },
  returns: profileResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    if (!isValidTimeZone(args.timeZone)) {
      throw new Error("Choose a valid time zone");
    }
    const caller = appIdentity(identity);
    const existing = await getProfileHandler(ctx, caller.tokenIdentifier);
    if (existing) {
      await ctx.db.patch(existing._id, {
        timeZone: args.timeZone,
        tokenIdentifier: caller.tokenIdentifier,
      });
      return {
        locale: resolveSupportedLocale(existing.locale),
        timeZone: args.timeZone,
        isAdmin: existing.isAdmin,
      };
    }
    await ctx.db.insert("userProfiles", {
      userId: caller.authUserId,
      tokenIdentifier: caller.tokenIdentifier,
      locale: DEFAULT_LOCALE,
      timeZone: args.timeZone,
      isAdmin: false,
    });
    return { locale: DEFAULT_LOCALE, timeZone: args.timeZone, isAdmin: false };
  },
});

export const requestLanguage = mutation({
  args: {
    requestedLocale: v.string(),
  },
  returns: v.id("languageRequests"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const requestedLocale = args.requestedLocale.trim();
    if (requestedLocale.length < 2 || requestedLocale.length > 100) {
      throw new Error("Enter a language name or language code");
    }
    return await ctx.db.insert("languageRequests", {
      userId: appIdentity(identity).authUserId,
      requestedLocale,
      createdAt: Date.now(),
    });
  },
});
