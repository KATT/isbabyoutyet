import type { QueryCtx } from "./_generated/server";

type AuthDbCtx = Pick<QueryCtx, "auth" | "db">;

export async function getUserAdminFlag(ctx: Pick<QueryCtx, "db">, userId: string) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  return profile?.isAdmin === true;
}

/**
 * Authenticated caller with `userProfiles.isAdmin`. Used for staff-only
 * dashboards (language requests, global baby list) — not baby-page roles.
 */
export async function requireAdmin(ctx: AuthDbCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  const isAdmin = await getUserAdminFlag(ctx, identity.subject);
  if (!isAdmin) {
    throw new Error("Not authorized");
  }
  return identity;
}
