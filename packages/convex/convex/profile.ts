import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { DEFAULT_LOCALE, resolveSupportedLocale } from "../src/i18n";
import { DEFAULT_TIME_ZONE, isValidTimeZone, resolveTimeZone } from "../src/timeZone";
import { supportedLocaleValidator } from "./i18n";
import { appIdentity } from "./authIdentity";
import { mutationWithTriggers } from "./triggers";

const profileResultValidator = v.object({
  isAdmin: v.boolean(),
  locale: supportedLocaleValidator,
  timeZone: v.string(),
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

function toProfileResult(
  profile: { isAdmin: boolean; locale: string } & Partial<{ timeZone: string }>,
) {
  return {
    isAdmin: profile.isAdmin,
    locale: resolveSupportedLocale(profile.locale),
    timeZone: resolveTimeZone(profile.timeZone),
  };
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const caller = appIdentity(identity);
    const profile = await getProfileHandler(ctx, caller.tokenIdentifier);
    return profile
      ? toProfileResult(profile)
      : { isAdmin: false, locale: DEFAULT_LOCALE, timeZone: DEFAULT_TIME_ZONE };
  },
  returns: v.union(profileResultValidator, v.null()),
});

export const updateLocale = mutationWithTriggers({
  args: {
    locale: supportedLocaleValidator,
  },
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
        isAdmin: existing.isAdmin,
        locale: args.locale,
        timeZone: resolveTimeZone(existing.timeZone),
      };
    }
    await ctx.db.insert("userProfiles", {
      isAdmin: false,
      locale: args.locale,
      timeZone: DEFAULT_TIME_ZONE,
      tokenIdentifier: caller.tokenIdentifier,
      userId: caller.authUserId,
    });
    return { isAdmin: false, locale: args.locale, timeZone: DEFAULT_TIME_ZONE };
  },
  returns: profileResultValidator,
});

export const updateTimeZone = mutation({
  args: {
    timeZone: v.string(),
  },
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
        isAdmin: existing.isAdmin,
        locale: resolveSupportedLocale(existing.locale),
        timeZone: args.timeZone,
      };
    }
    await ctx.db.insert("userProfiles", {
      isAdmin: false,
      locale: DEFAULT_LOCALE,
      timeZone: args.timeZone,
      tokenIdentifier: caller.tokenIdentifier,
      userId: caller.authUserId,
    });
    return { isAdmin: false, locale: DEFAULT_LOCALE, timeZone: args.timeZone };
  },
  returns: profileResultValidator,
});
