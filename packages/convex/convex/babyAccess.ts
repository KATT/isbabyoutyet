import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { AppIdentity } from "./authIdentity";
import { appIdentity } from "./authIdentity";
import { isActive } from "./softDelete";

type DbCtx = QueryCtx | MutationCtx;

export async function findActiveCoParent(
  ctx: DbCtx,
  babyId: Id<"baby">,
  identity: AppIdentity,
): Promise<Doc<"babyCoParents"> | null> {
  const rows = await ctx.db
    .query("babyCoParents")
    .withIndex("by_babyId_userId", (q) => q.eq("babyId", babyId).eq("userId", identity.authUserId))
    .collect();
  return (
    rows.find(
      (row) =>
        isActive(row) &&
        (row.tokenIdentifier === undefined || row.tokenIdentifier === identity.tokenIdentifier),
    ) ?? null
  );
}

export async function canManageBaby(ctx: DbCtx, baby: Doc<"baby">, identity: AppIdentity) {
  const isOwner =
    baby.ownerTokenIdentifier === identity.tokenIdentifier ||
    (baby.ownerTokenIdentifier === undefined && baby.userId === identity.authUserId);
  if (isOwner) return true;
  const coParent = await findActiveCoParent(ctx, baby._id, identity);
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
  const caller = appIdentity(identity);

  const baby = await ctx.db.get(babyId);
  if (!baby || !isActive(baby)) {
    throw new Error("Baby not found");
  }

  const isOwner =
    baby.ownerTokenIdentifier === caller.tokenIdentifier ||
    (baby.ownerTokenIdentifier === undefined && baby.userId === caller.authUserId);
  if (!isOwner) {
    const coParent = await findActiveCoParent(ctx, babyId, caller);
    if (!coParent) {
      throw new Error("Not authorized");
    }
  }

  return { identity: caller, baby, isOwner };
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
