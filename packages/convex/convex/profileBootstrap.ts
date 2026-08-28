import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { resolveSupportedLocale } from "../src/i18n";
import type { SupportedLocale } from "../src/i18n";
import { resolveTimeZone } from "../src/timeZone";
import { tokenIdentifierForAuthUserId } from "./authIdentity";
import {
  claimPendingInvitesForAuthUser,
  claimPendingInvitesForAuthUserId,
} from "./coParentInviteClaims";

export type ProfileResult = {
  locale: SupportedLocale;
  timeZone: string;
  isAdmin: boolean;
};

async function getProfileByTokenIdentifier(ctx: Pick<QueryCtx, "db">, tokenIdentifier: string) {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
}

export function localeFromAcceptLanguage(acceptLanguage: string | null | undefined) {
  const primary = acceptLanguage?.split(",")[0]?.trim();
  return resolveSupportedLocale(primary);
}

export async function applyExistingProfileTimeZone(
  ctx: MutationCtx,
  opts: {
    profile: Doc<"userProfiles">;
    timeZoneHint: string | null | undefined;
  },
) {
  const timeZone = resolveTimeZone(opts.profile.timeZone ?? opts.timeZoneHint);
  if (opts.profile.timeZone === undefined) {
    await ctx.db.patch(opts.profile._id, { timeZone });
  }
  return timeZone;
}

/** Creates the app profile row on first auth; idempotent on later calls. */
export async function ensureUserProfileForAuthUser(
  ctx: MutationCtx,
  opts: {
    userId: string;
    localeHint: string | null | undefined;
    timeZoneHint: string | null | undefined;
  },
): Promise<ProfileResult> {
  const tokenIdentifier = tokenIdentifierForAuthUserId(opts.userId);
  const existing = await getProfileByTokenIdentifier(ctx, tokenIdentifier);
  if (existing) {
    const timeZone = await applyExistingProfileTimeZone(ctx, {
      profile: existing,
      timeZoneHint: opts.timeZoneHint,
    });
    return {
      locale: resolveSupportedLocale(existing.locale),
      timeZone,
      isAdmin: existing.isAdmin,
    };
  }

  const locale = resolveSupportedLocale(opts.localeHint);
  const timeZone = resolveTimeZone(opts.timeZoneHint);
  await ctx.db.insert("userProfiles", {
    userId: opts.userId,
    tokenIdentifier,
    locale,
    timeZone,
    isAdmin: false,
  });
  return { locale, timeZone, isAdmin: false };
}

export async function claimInvitesForAuthUser(
  ctx: MutationCtx,
  opts: {
    userId: string;
    email: string | null;
    name: string | null;
  },
) {
  if (opts.email) {
    await claimPendingInvitesForAuthUser(ctx, {
      userId: opts.userId,
      email: opts.email,
      name: opts.name,
    });
    return;
  }

  await claimPendingInvitesForAuthUserId(ctx, opts.userId);
}

export const ensureUserProfileForAuthUserMutation = internalMutation({
  args: {
    userId: v.string(),
    localeHint: v.union(v.string(), v.null()),
    timeZoneHint: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    return await ensureUserProfileForAuthUser(ctx, args);
  },
});

export const claimInvitesForAuthUserMutation = internalMutation({
  args: {
    userId: v.string(),
    email: v.union(v.string(), v.null()),
    name: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await claimInvitesForAuthUser(ctx, args);
  },
});
