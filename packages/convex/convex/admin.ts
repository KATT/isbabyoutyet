import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentStatus } from "../src/types";
import { HOMEPAGE_DEMO_OWNER_USER_ID } from "../src/seedCredentials";
import { requireAdmin } from "./adminAccess";
import { isActive } from "./softDelete";

const sortByValidator = v.union(v.literal("created"), v.literal("updated"));
const sortOrderValidator = v.union(v.literal("asc"), v.literal("desc"));

const languageRequestRowValidator = v.object({
  _id: v.id("languageRequests"),
  requestedLocale: v.string(),
  createdAt: v.number(),
  userId: v.string(),
  userEmail: v.union(v.string(), v.null()),
});

const babyRowValidator = v.object({
  _id: v.id("baby"),
  name: v.string(),
  publicId: v.string(),
  dueDate: v.string(),
  status: v.union(
    v.literal("not_yet"),
    v.literal("labor_started"),
    v.literal("gone_to_hospital"),
    v.literal("born"),
  ),
  demo: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  managerEmails: v.array(v.string()),
});

/**
 * Resolve a Better Auth user's email. Sentinel / non-document owners
 * (homepage live demos use `homepage-demo`) are not Better Auth rows — looking
 * them up by `_id` throws "Invalid ID length", so skip those.
 */
async function findUserEmail(ctx: QueryCtx, userId: string) {
  if (userId === HOMEPAGE_DEMO_OWNER_USER_ID) {
    return null;
  }
  try {
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "_id", value: userId }],
    });
    if (!user?.email) return null;
    return String(user.email);
  } catch {
    // Orphan / non-document userIds must not fail the whole admin list.
    return null;
  }
}

async function managerEmailsForBaby(ctx: QueryCtx, baby: Doc<"baby">) {
  const emails: string[] = [];
  const ownerEmail = await findUserEmail(ctx, baby.userId);
  if (ownerEmail) {
    emails.push(ownerEmail);
  }

  const coParents = await ctx.db
    .query("babyCoParents")
    .withIndex("by_babyId", (q) => q.eq("babyId", baby._id))
    .collect();
  for (const row of coParents) {
    if (!isActive(row)) continue;
    if (!emails.includes(row.email)) {
      emails.push(row.email);
    }
  }
  return emails;
}

async function lastActivityAt(ctx: QueryCtx, opts: { babyId: Id<"baby">; createdAt: number }) {
  const items = await ctx.db
    .query("timelineItems")
    .withIndex("by_babyId_postedAt", (q) => q.eq("babyId", opts.babyId))
    .order("desc")
    .take(20);
  const latest = items.find(isActive);
  if (!latest) {
    return opts.createdAt;
  }
  return Math.max(opts.createdAt, latest.postedAt);
}

/** Offset-cursor pagination over an already-sorted in-memory list (admin scale). */
function paginateSorted<T>(
  items: T[],
  paginationOpts: { numItems: number; cursor: string | null },
) {
  const startIndex = paginationOpts.cursor ? Number.parseInt(paginationOpts.cursor, 10) : 0;
  if (!Number.isFinite(startIndex) || startIndex < 0) {
    throw new Error("Invalid pagination cursor");
  }
  const endIndex = startIndex + paginationOpts.numItems;
  return {
    page: items.slice(startIndex, endIndex),
    isDone: endIndex >= items.length,
    continueCursor: String(endIndex),
  };
}

export const listLanguageRequests = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(languageRequestRowValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("languageRequests").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);

    const emailByUserId = new Map<string, string | null>();
    const mapped = [];
    for (const row of rows) {
      let userEmail = emailByUserId.get(row.userId);
      if (userEmail === undefined) {
        userEmail = await findUserEmail(ctx, row.userId);
        emailByUserId.set(row.userId, userEmail);
      }
      mapped.push({
        _id: row._id,
        requestedLocale: row.requestedLocale,
        createdAt: row.createdAt,
        userId: row.userId,
        userEmail,
      });
    }
    return paginateSorted(mapped, args.paginationOpts);
  },
});

export const listBabies = query({
  args: {
    sortBy: sortByValidator,
    sortOrder: sortOrderValidator,
    hideDemo: v.boolean(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(babyRowValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const babies = await ctx.db.query("baby").collect();
    const active = babies.filter(isActive).filter((baby) => {
      if (!args.hideDemo) return true;
      return baby.demo !== true;
    });

    const rows = [];
    for (const baby of active) {
      const createdAt = baby._creationTime;
      const updatedAt = await lastActivityAt(ctx, { babyId: baby._id, createdAt });
      rows.push({
        _id: baby._id,
        name: baby.name,
        publicId: baby.publicId,
        dueDate: baby.dueDate,
        status: getCurrentStatus(baby).type,
        demo: baby.demo === true,
        createdAt,
        updatedAt,
        managerEmails: await managerEmailsForBaby(ctx, baby),
      });
    }

    const key = args.sortBy === "created" ? "createdAt" : "updatedAt";
    const direction = args.sortOrder === "asc" ? 1 : -1;
    rows.sort((a, b) => (a[key] - b[key]) * direction);
    return paginateSorted(rows, args.paginationOpts);
  },
});
