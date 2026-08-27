import type { MutationCtx, QueryCtx } from "./_generated/server";
import { components } from "./_generated/api";
import { tokenIdentifierForAuthUserId } from "./authIdentity";
import { findActiveCoParent } from "./babyAccess";
import { isActive, softDeletePatch } from "./softDelete";
import { parseOptionalString } from "../src/jsonValue";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function findUserById(ctx: QueryCtx | MutationCtx, userId: string) {
  return await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", value: userId }],
  });
}

async function resolveAuthUserProfile(ctx: QueryCtx | MutationCtx, userId: string) {
  const byId = await findUserById(ctx, userId);
  if (!byId?.email) {
    return null;
  }
  return {
    email: normalizeEmail(String(byId.email)),
    name: parseOptionalString(byId.name),
  };
}

/**
 * Turns pending email invites into co-parent rows for a Better Auth user.
 * Idempotent — safe on sign-up, sign-in, and profile bootstrap.
 */
export async function claimPendingInvitesForAuthUser(
  ctx: MutationCtx,
  opts: { userId: string; email: string; name: string | null },
) {
  const email = normalizeEmail(opts.email);
  const caller = {
    authUserId: opts.userId,
    tokenIdentifier: tokenIdentifierForAuthUserId(opts.userId),
  };
  const name = opts.name;

  const invites = await ctx.db
    .query("babyCoParentInvites")
    .withIndex("by_email", (q) => q.eq("email", email))
    .order("desc")
    .take(100);

  let claimed = 0;
  for (const invite of invites) {
    if (!isActive(invite)) continue;

    const baby = await ctx.db.get(invite.babyId);
    if (!baby || !isActive(baby)) {
      await ctx.db.patch(invite._id, softDeletePatch());
      continue;
    }

    const isOwner = baby.ownerTokenIdentifier === caller.tokenIdentifier;
    if (isOwner) {
      await ctx.db.patch(invite._id, softDeletePatch());
      continue;
    }

    const existing = await findActiveCoParent(ctx, {
      babyId: invite.babyId,
      identity: caller,
    });
    if (!existing) {
      await ctx.db.insert("babyCoParents", {
        babyId: invite.babyId,
        userId: caller.authUserId,
        tokenIdentifier: caller.tokenIdentifier,
        email,
        name,
        addedByUserId: invite.invitedByUserId,
        addedAt: Date.now(),
      });
      claimed += 1;
    }
    await ctx.db.patch(invite._id, softDeletePatch());
  }

  return claimed;
}

/** Loads the auth user's email from Better Auth, then claims pending invites. */
export async function claimPendingInvitesForAuthUserId(ctx: MutationCtx, userId: string) {
  const profile = await resolveAuthUserProfile(ctx, userId);
  if (!profile) {
    return 0;
  }
  return await claimPendingInvitesForAuthUser(ctx, {
    userId,
    email: profile.email,
    name: profile.name,
  });
}
