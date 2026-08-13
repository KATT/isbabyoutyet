import { v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { findActiveCoParent, requireBabyManager, requireBabyOwner } from "./babyAccess";
import { isActive, softDeletePatch } from "./softDelete";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function findUserById(ctx: QueryCtx | MutationCtx, userId: string) {
  return await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", value: userId }],
  });
}

async function findUserByEmail(ctx: QueryCtx | MutationCtx, email: string) {
  return await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", value: email }],
  });
}

async function resolveCallerProfile(ctx: QueryCtx | MutationCtx, userId: string) {
  const authUser = await authComponent.safeGetAuthUser(ctx).catch(() => null);
  if (authUser?.email) {
    return {
      email: normalizeEmail(String(authUser.email)),
      name: typeof authUser.name === "string" ? authUser.name : null,
    };
  }
  const byId = await findUserById(ctx, userId);
  if (!byId?.email) return null;
  return {
    email: normalizeEmail(String(byId.email)),
    name: typeof byId.name === "string" ? byId.name : null,
  };
}

async function findActiveInvite(
  ctx: QueryCtx | MutationCtx,
  opts: { babyId: Id<"baby">; email: string },
) {
  const invites = await ctx.db
    .query("babyCoParentInvites")
    .withIndex("by_babyId_email", (q) => q.eq("babyId", opts.babyId).eq("email", opts.email))
    .collect();
  return invites.find(isActive) ?? null;
}

async function listActiveCoParents(ctx: QueryCtx | MutationCtx, babyId: Id<"baby">) {
  const rows = await ctx.db
    .query("babyCoParents")
    .withIndex("by_babyId", (q) => q.eq("babyId", babyId))
    .collect();
  return rows.filter(isActive);
}

async function listActiveInvites(ctx: QueryCtx | MutationCtx, babyId: Id<"baby">) {
  const rows = await ctx.db
    .query("babyCoParentInvites")
    .withIndex("by_babyId", (q) => q.eq("babyId", babyId))
    .collect();
  return rows.filter(isActive);
}

/**
 * Access flags for the signed-in user on a baby page.
 * Anonymous callers get canManage/isOwner false.
 */
export const myAccess = query({
  args: { babyId: v.id("baby") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { isOwner: false, isCoParent: false, canManage: false };
    }

    const baby = await ctx.db.get(args.babyId);
    if (!baby || !isActive(baby)) {
      return { isOwner: false, isCoParent: false, canManage: false };
    }

    const isOwner = baby.userId === identity.subject;
    const isCoParent =
      !isOwner &&
      (await findActiveCoParent(ctx, { babyId: args.babyId, userId: identity.subject })) != null;
    return { isOwner, isCoParent, canManage: isOwner || isCoParent };
  },
});

/**
 * Owner/co-parent view of current co-parents and pending invites.
 */
export const listForBaby = query({
  args: { babyId: v.id("baby") },
  handler: async (ctx, args) => {
    await requireBabyManager(ctx, args.babyId);

    const [coParents, invites] = await Promise.all([
      listActiveCoParents(ctx, args.babyId),
      listActiveInvites(ctx, args.babyId),
    ]);

    return {
      coParents: coParents.map((row) => ({
        _id: row._id,
        email: row.email,
        name: row.name ?? null,
        userId: row.userId,
        addedAt: row.addedAt,
      })),
      invites: invites.map((row) => ({
        _id: row._id,
        email: row.email,
        createdAt: row.createdAt,
      })),
    };
  },
});

/**
 * Owner invites a co-parent by email. Existing accounts are added immediately;
 * unknown emails become a pending invite claimed on next sign-in.
 */
export const invite = mutation({
  args: {
    babyId: v.id("baby"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity, baby } = await requireBabyOwner(ctx, args.babyId);
    const email = normalizeEmail(args.email);
    if (!email.includes("@")) {
      throw new Error("Enter a valid email address");
    }

    const caller = await resolveCallerProfile(ctx, identity.subject);
    if (caller && caller.email === email) {
      throw new Error("You already own this page");
    }

    const existingUser = await findUserByEmail(ctx, email);
    if (existingUser) {
      const userId = String(existingUser._id);
      if (userId === baby.userId) {
        throw new Error("That person already owns this page");
      }
      const existing = await findActiveCoParent(ctx, { babyId: args.babyId, userId });
      if (existing) {
        throw new Error("That person is already a co-parent");
      }

      // Clear any stale pending invite for this email
      const pending = await findActiveInvite(ctx, { babyId: args.babyId, email });
      if (pending) {
        await ctx.db.patch(pending._id, softDeletePatch());
      }

      await ctx.db.insert("babyCoParents", {
        babyId: args.babyId,
        userId,
        email,
        name: typeof existingUser.name === "string" ? existingUser.name : null,
        addedByUserId: identity.subject,
        addedAt: Date.now(),
      });
      return { status: "added" as const };
    }

    const pending = await findActiveInvite(ctx, { babyId: args.babyId, email });
    if (pending) {
      throw new Error("An invite is already pending for that email");
    }

    await ctx.db.insert("babyCoParentInvites", {
      babyId: args.babyId,
      email,
      invitedByUserId: identity.subject,
      createdAt: Date.now(),
    });
    return { status: "invited" as const };
  },
});

export const removeCoParent = mutation({
  args: { coParentId: v.id("babyCoParents") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.coParentId);
    if (!row || !isActive(row)) {
      throw new Error("Co-parent not found");
    }
    await requireBabyOwner(ctx, row.babyId);
    await ctx.db.patch(args.coParentId, softDeletePatch());
  },
});

export const cancelInvite = mutation({
  args: { inviteId: v.id("babyCoParentInvites") },
  handler: async (ctx, args) => {
    const inviteRow = await ctx.db.get(args.inviteId);
    if (!inviteRow || !isActive(inviteRow)) {
      throw new Error("Invite not found");
    }
    await requireBabyOwner(ctx, inviteRow.babyId);
    await ctx.db.patch(args.inviteId, softDeletePatch());
  },
});

/**
 * Co-parent leaves a baby page they were added to.
 */
export const leave = mutation({
  args: { babyId: v.id("baby") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const membership = await findActiveCoParent(ctx, {
      babyId: args.babyId,
      userId: identity.subject,
    });
    if (!membership) {
      throw new Error("You are not a co-parent on this page");
    }
    await ctx.db.patch(membership._id, softDeletePatch());
  },
});

/**
 * Turns pending email invites for the signed-in user into co-parent rows.
 * Safe to call repeatedly from the authenticated layout.
 */
export const claimPendingInvites = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    // After signup the first dashboard load can race the session cookie —
    // treat missing auth as a no-op so the page doesn't crash.
    if (!identity) {
      return { claimed: 0 };
    }

    const profile = await resolveCallerProfile(ctx, identity.subject);
    if (!profile) {
      return { claimed: 0 };
    }

    const email = profile.email;
    const name = profile.name;

    const invites = await ctx.db
      .query("babyCoParentInvites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();

    let claimed = 0;
    for (const inviteRow of invites) {
      if (!isActive(inviteRow)) continue;

      const baby = await ctx.db.get(inviteRow.babyId);
      if (!baby || !isActive(baby)) {
        await ctx.db.patch(inviteRow._id, softDeletePatch());
        continue;
      }

      // Never make the owner a co-parent of their own page
      if (baby.userId === identity.subject) {
        await ctx.db.patch(inviteRow._id, softDeletePatch());
        continue;
      }

      const existing = await findActiveCoParent(ctx, {
        babyId: inviteRow.babyId,
        userId: identity.subject,
      });
      if (!existing) {
        await ctx.db.insert("babyCoParents", {
          babyId: inviteRow.babyId,
          userId: identity.subject,
          email,
          name,
          addedByUserId: inviteRow.invitedByUserId,
          addedAt: Date.now(),
        });
        claimed += 1;
      }
      await ctx.db.patch(inviteRow._id, softDeletePatch());
    }

    return { claimed };
  },
});

/**
 * Babies the caller owns or co-parents, with a role for dashboard labeling.
 */
export async function listBabiesForUser(ctx: QueryCtx, userId: string) {
  const owned = await ctx.db
    .query("baby")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .collect();

  const memberships = await ctx.db
    .query("babyCoParents")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  const shared: Array<Doc<"baby"> & { role: "owner" | "coParent" }> = [];
  const seen = new Set<string>();

  for (const baby of owned.filter(isActive)) {
    seen.add(baby._id);
    shared.push({ ...baby, role: "owner" });
  }

  for (const membership of memberships.filter(isActive)) {
    if (seen.has(membership.babyId)) continue;
    const baby = await ctx.db.get(membership.babyId);
    if (!baby || !isActive(baby)) continue;
    seen.add(baby._id);
    shared.push({ ...baby, role: "coParent" });
  }

  // Newest first across both sources
  shared.sort((a, b) => b._creationTime - a._creationTime);
  return shared;
}
