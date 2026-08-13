import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { resolveSupportedLocale } from "../src/i18n";
import { supportedLocaleValidator } from "./i18n";
import { appIdentity } from "./authIdentity";

const profileResultValidator = v.object({
  locale: supportedLocaleValidator,
});

async function requireIdentity(ctx: Pick<QueryCtx, "auth">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

async function getProfileHandler(ctx: Pick<QueryCtx, "db">, userId: string) {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
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
    const profile = await getProfileHandler(ctx, caller.authUserId);
    if (profile?.tokenIdentifier && profile.tokenIdentifier !== caller.tokenIdentifier) {
      return null;
    }
    return profile ? { locale: resolveSupportedLocale(profile.locale) } : null;
  },
});

export const ensure = mutation({
  args: {
    browserLocale: v.string(),
  },
  returns: profileResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const caller = appIdentity(identity);
    const existing = await getProfileHandler(ctx, caller.authUserId);
    if (existing) {
      if (existing.tokenIdentifier === undefined) {
        await ctx.db.patch(existing._id, { tokenIdentifier: caller.tokenIdentifier });
      }
      return { locale: resolveSupportedLocale(existing.locale) };
    }

    const locale = resolveSupportedLocale(args.browserLocale);
    await ctx.db.insert("userProfiles", {
      userId: caller.authUserId,
      tokenIdentifier: caller.tokenIdentifier,
      locale,
    });
    return { locale };
  },
});

export const updateLocale = mutation({
  args: {
    locale: supportedLocaleValidator,
  },
  returns: profileResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const caller = appIdentity(identity);
    const existing = await getProfileHandler(ctx, caller.authUserId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        locale: args.locale,
        tokenIdentifier: caller.tokenIdentifier,
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userId: caller.authUserId,
        tokenIdentifier: caller.tokenIdentifier,
        locale: args.locale,
      });
    }
    return { locale: args.locale };
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
