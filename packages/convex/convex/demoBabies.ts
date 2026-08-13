import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { supportedLocaleValidator } from "./i18n";
import { isActive } from "./softDelete";

const PLAYGROUND_LIFETIME_MS = 4 * 24 * 60 * 60 * 1000;
const COPY_ITEM_LIMIT = 100;
const DELETE_BATCH_SIZE = 50;
const PLAYGROUND_OWNER_USER_ID = "demo-playground";

type PlaygroundDemo = Extract<NonNullable<Doc<"baby">["demo"]>, { kind: "playground" }>;
type PlaygroundBaby = Doc<"baby"> & { demo: PlaygroundDemo };

const settingsUpdateValidator = v.object({
  laborStarted: v.optional(v.union(v.string(), v.null())),
  wentToHospital: v.optional(v.union(v.string(), v.null())),
  babyBorn: v.optional(v.union(v.string(), v.null())),
  dueDate: v.optional(v.string()),
  name: v.optional(v.string()),
  theme: v.optional(v.union(v.string(), v.null())),
  locale: v.optional(v.union(supportedLocaleValidator, v.null())),
  encouragementsDisabled: v.optional(v.boolean()),
});

const accessResultValidator = v.object({
  kind: v.union(v.literal("none"), v.literal("source"), v.literal("playground")),
  canEdit: v.boolean(),
  expiresAt: v.union(v.number(), v.null()),
});

export function isDemoSource(baby: Doc<"baby">) {
  return baby.demo === true || (typeof baby.demo === "object" && baby.demo.kind === "source");
}

function isPlaygroundBaby(baby: Doc<"baby">): baby is PlaygroundBaby {
  return typeof baby.demo === "object" && baby.demo.kind === "playground";
}

function validateVisitorId(visitorId: string) {
  if (visitorId.length < 1 || visitorId.length > 128) {
    throw new Error("Invalid visitor");
  }
}

async function getAccess(baby: Doc<"baby">, visitorId: string, now: number) {
  if (isDemoSource(baby)) {
    return { kind: "source" as const, canEdit: true, expiresAt: null };
  }
  if (!isPlaygroundBaby(baby)) {
    return { kind: "none" as const, canEdit: false, expiresAt: null };
  }
  return {
    kind: "playground" as const,
    canEdit: baby.demo.visitorId === visitorId && baby.demo.expiresAt > now,
    expiresAt: baby.demo.expiresAt,
  };
}

/** Visitor-scoped edit capability for a demo source or playground baby. */
export const access = query({
  args: {
    babyId: v.id("baby"),
    visitorId: v.string(),
    now: v.number(),
  },
  returns: accessResultValidator,
  handler: async (ctx, args) => {
    validateVisitorId(args.visitorId);
    const baby = await ctx.db.get(args.babyId);
    if (!baby || !isActive(baby)) {
      return { kind: "none" as const, canEdit: false, expiresAt: null };
    }
    return await getAccess(baby, args.visitorId, args.now);
  },
});

async function findVisitorPlayground(
  ctx: QueryCtx | MutationCtx,
  sourceBabyId: Id<"baby">,
  visitorId: string,
) {
  const candidates = await ctx.db
    .query("baby")
    .withIndex("by_demo_visitorId_and_sourceBabyId", (q) =>
      q.eq("demo.visitorId", visitorId).eq("demo.sourceBabyId", sourceBabyId),
    )
    .order("desc")
    .take(10);
  const now = Date.now();
  return (
    candidates.find(
      (baby) => isActive(baby) && isPlaygroundBaby(baby) && baby.demo.expiresAt > now,
    ) ?? null
  );
}

async function copyTimeline(ctx: MutationCtx, sourceBabyId: Id<"baby">, babyId: Id<"baby">) {
  const items = await ctx.db
    .query("timelineItems")
    .withIndex("by_babyId_postedAt", (q) => q.eq("babyId", sourceBabyId))
    .take(COPY_ITEM_LIMIT + 1);
  if (items.length > COPY_ITEM_LIMIT) {
    throw new Error("This demo source is too large to copy");
  }

  for (const item of items) {
    const timelineItemId = await ctx.db.insert("timelineItems", {
      babyId,
      kind: item.kind,
      postedAt: item.postedAt,
    });

    switch (item.kind) {
      case "update": {
        const update = await ctx.db
          .query("updates")
          .withIndex("by_timelineItemId", (q) => q.eq("timelineItemId", item._id))
          .unique();
        if (!update || !isActive(update)) break;
        await ctx.db.insert("updates", {
          babyId,
          timelineItemId,
          message: update.message,
          milestone: update.milestone,
          occurredAt: update.occurredAt,
          photoId: update.photoId,
          thumbnailId: update.thumbnailId,
          postedByUserId: update.postedByUserId,
        });
        break;
      }
      case "encouragement": {
        const encouragement = await ctx.db
          .query("encouragements")
          .withIndex("by_timelineItemId", (q) => q.eq("timelineItemId", item._id))
          .unique();
        if (!encouragement || !isActive(encouragement)) break;
        await ctx.db.insert("encouragements", {
          babyId,
          timelineItemId,
          authorName: encouragement.authorName,
          message: encouragement.message,
          createdAt: encouragement.createdAt,
          visitorId: encouragement.visitorId,
          userAgent: encouragement.userAgent,
          locale: encouragement.locale,
          timezone: encouragement.timezone,
        });
        break;
      }
    }
  }
}

async function createPlayground(ctx: MutationCtx, source: Doc<"baby">, visitorId: string) {
  const existing = await findVisitorPlayground(ctx, source._id, visitorId);
  if (existing) return { playground: existing, created: false };

  const expiresAt = Date.now() + PLAYGROUND_LIFETIME_MS;
  const babyId = await ctx.db.insert("baby", {
    userId: PLAYGROUND_OWNER_USER_ID,
    name: source.name,
    dueDate: source.dueDate,
    publicId: `demo-playground-${crypto.randomUUID()}`,
    hospitalMessage: source.hospitalMessage,
    babyBornMessage: source.babyBornMessage,
    laborStartedMessage: source.laborStartedMessage,
    laborStarted: source.laborStarted,
    wentToHospital: source.wentToHospital,
    babyBorn: source.babyBorn,
    theme: source.theme,
    locale: source.locale,
    encouragementsDisabled: source.encouragementsDisabled,
    photoId: source.photoId,
    thumbnailId: source.thumbnailId,
    demo: {
      kind: "playground",
      sourceBabyId: source._id,
      visitorId,
      expiresAt,
    },
  });
  await copyTimeline(ctx, source._id, babyId);
  const playground = await ctx.db.get(babyId);
  if (!playground) {
    throw new Error("Failed to create playground");
  }
  return { playground, created: true };
}

function validateDate(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error("Invalid date");
  }
  if (parsed > Date.now() + 60_000) {
    throw new Error("The event time cannot be in the future");
  }
  return parsed;
}

async function updateMilestoneOccurredAt(
  ctx: MutationCtx,
  babyId: Id<"baby">,
  milestone: "labor_started" | "gone_to_hospital" | "born",
  value: string | null | undefined,
) {
  if (value === undefined) return;
  const update = await ctx.db
    .query("updates")
    .withIndex("by_babyId_milestone", (q) => q.eq("babyId", babyId).eq("milestone", milestone))
    .unique();
  if (!update || !isActive(update)) return;
  await ctx.db.patch(update._id, { occurredAt: value === null ? null : validateDate(value) });
}

async function applySettingsUpdate(
  ctx: MutationCtx,
  baby: Doc<"baby">,
  update: {
    laborStarted?: string | null;
    wentToHospital?: string | null;
    babyBorn?: string | null;
    dueDate?: string;
    name?: string;
    theme?: string | null;
    locale?: "en-GB" | "en-US" | "sv" | "es" | "pt-BR" | null;
    encouragementsDisabled?: boolean;
  },
) {
  if (!isPlaygroundBaby(baby)) {
    throw new Error("Not a playground baby");
  }
  if (update.laborStarted !== undefined && update.laborStarted !== null) {
    validateDate(update.laborStarted);
  }
  if (update.wentToHospital !== undefined && update.wentToHospital !== null) {
    validateDate(update.wentToHospital);
  }
  if (update.babyBorn !== undefined && update.babyBorn !== null) {
    validateDate(update.babyBorn);
  }

  await updateMilestoneOccurredAt(ctx, baby._id, "labor_started", update.laborStarted);
  await updateMilestoneOccurredAt(ctx, baby._id, "gone_to_hospital", update.wentToHospital);
  await updateMilestoneOccurredAt(ctx, baby._id, "born", update.babyBorn);

  const expiresAt = Date.now() + PLAYGROUND_LIFETIME_MS;
  await ctx.db.patch(baby._id, {
    ...update,
    demo: {
      kind: "playground",
      sourceBabyId: baby.demo.sourceBabyId,
      visitorId: baby.demo.visitorId,
      expiresAt,
    },
  });
  return expiresAt;
}

/**
 * Copy-on-first-edit settings mutation. The source never changes; later edits
 * reuse the visitor's same playground and extend its four-day lifetime.
 */
export const updateSettings = mutation({
  args: {
    babyId: v.id("baby"),
    visitorId: v.string(),
    update: settingsUpdateValidator,
  },
  returns: v.object({
    babyId: v.id("baby"),
    publicId: v.string(),
    created: v.boolean(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    validateVisitorId(args.visitorId);
    const requested = await ctx.db.get(args.babyId);
    if (!requested || !isActive(requested)) {
      throw new Error("Baby not found");
    }

    let playground: Doc<"baby">;
    let created = false;
    if (isDemoSource(requested)) {
      const result = await createPlayground(ctx, requested, args.visitorId);
      playground = result.playground;
      created = result.created;
    } else if (
      isPlaygroundBaby(requested) &&
      requested.demo.visitorId === args.visitorId &&
      requested.demo.expiresAt > Date.now()
    ) {
      playground = requested;
    } else {
      throw new Error("Not authorized");
    }

    const expiresAt = await applySettingsUpdate(ctx, playground, args.update);
    return {
      babyId: playground._id,
      publicId: playground.publicId,
      created,
      expiresAt,
    };
  },
});

async function scheduleDeleteContinuation(ctx: MutationCtx, babyId: Id<"baby">) {
  await ctx.scheduler.runAfter(0, internal.demoBabies.deletePlayground, { babyId });
}

async function deleteTimelineBatch(ctx: MutationCtx, babyId: Id<"baby">) {
  const items = await ctx.db
    .query("timelineItems")
    .withIndex("by_babyId_postedAt", (q) => q.eq("babyId", babyId))
    .take(DELETE_BATCH_SIZE);
  for (const item of items) {
    if (item.kind === "update") {
      const update = await ctx.db
        .query("updates")
        .withIndex("by_timelineItemId", (q) => q.eq("timelineItemId", item._id))
        .unique();
      if (update) await ctx.db.delete(update._id);
    } else {
      const encouragement = await ctx.db
        .query("encouragements")
        .withIndex("by_timelineItemId", (q) => q.eq("timelineItemId", item._id))
        .unique();
      if (encouragement) await ctx.db.delete(encouragement._id);
    }
    await ctx.db.delete(item._id);
  }
  return items.length === DELETE_BATCH_SIZE;
}

async function deleteIndexedRows(
  ctx: MutationCtx,
  table:
    | "babyPublicIdHistory"
    | "pushSubscriptions"
    | "scheduledNotifications"
    | "babyCoParents"
    | "babyCoParentInvites",
  babyId: Id<"baby">,
) {
  const rows = await ctx.db
    .query(table)
    .withIndex("by_babyId", (q) => q.eq("babyId", babyId))
    .take(DELETE_BATCH_SIZE);
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  return rows.length === DELETE_BATCH_SIZE;
}

export const deletePlayground = internalMutation({
  args: { babyId: v.id("baby") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const baby = await ctx.db.get(args.babyId);
    if (!baby || !isPlaygroundBaby(baby)) return null;
    if (baby.demo.expiresAt > Date.now()) return null;

    if (await deleteTimelineBatch(ctx, baby._id)) {
      await scheduleDeleteContinuation(ctx, baby._id);
      return null;
    }

    const tables = [
      "babyPublicIdHistory",
      "pushSubscriptions",
      "scheduledNotifications",
      "babyCoParents",
      "babyCoParentInvites",
    ] as const;
    for (const table of tables) {
      if (await deleteIndexedRows(ctx, table, baby._id)) {
        await scheduleDeleteContinuation(ctx, baby._id);
        return null;
      }
    }

    await ctx.db.delete(baby._id);
    return null;
  },
});

/** Finds expired playground pages and fans their bounded deletion work out. */
export const cleanupExpired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("baby")
      .withIndex("by_demo_expiresAt", (q) =>
        q.gt("demo.expiresAt", 0).lte("demo.expiresAt", Date.now()),
      )
      .take(10);
    for (const baby of expired) {
      if (isPlaygroundBaby(baby)) {
        await scheduleDeleteContinuation(ctx, baby._id);
      }
    }
    return null;
  },
});
