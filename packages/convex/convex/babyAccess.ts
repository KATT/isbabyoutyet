import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { isActive } from "./softDelete";

type DbCtx = QueryCtx | MutationCtx;

export async function findActiveCoParent(
  ctx: DbCtx,
  opts: { babyId: Id<"baby">; userId: string },
): Promise<Doc<"babyCoParents"> | null> {
  const rows = await ctx.db
    .query("babyCoParents")
    .withIndex("by_babyId_userId", (q) => q.eq("babyId", opts.babyId).eq("userId", opts.userId))
    .collect();
  return rows.find(isActive) ?? null;
}

export async function canManageBaby(ctx: DbCtx, opts: { baby: Doc<"baby">; userId: string }) {
  if (opts.baby.userId === opts.userId) return true;
  const coParent = await findActiveCoParent(ctx, {
    babyId: opts.baby._id,
    userId: opts.userId,
  });
  return coParent != null;
}

/**
 * Authenticated caller who may manage baby content (owner or co-parent).
 * Does not allow soft-deleted babies.
 */
export async function requireBabyManager(ctx: DbCtx, babyId: Id<"baby">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const baby = await ctx.db.get(babyId);
  if (!baby || !isActive(baby)) {
    throw new Error("Baby not found");
  }

  const isOwner = baby.userId === identity.subject;
  if (!isOwner) {
    const coParent = await findActiveCoParent(ctx, {
      babyId,
      userId: identity.subject,
    });
    if (!coParent) {
      throw new Error("Not authorized");
    }
  }

  return { identity, baby, isOwner };
}

/**
 * Only the baby page owner (creator). Co-parents are refused.
 */
export async function requireBabyOwner(ctx: DbCtx, babyId: Id<"baby">) {
  const access = await requireBabyManager(ctx, babyId);
  if (!access.isOwner) {
    throw new Error("Not authorized");
  }
  return access;
}
