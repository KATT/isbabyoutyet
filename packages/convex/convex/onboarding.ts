import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { isOnboardingStepId, ONBOARDING_STEP_IDS } from "../src/onboardingSteps";

const emptyState = {
  welcomeDismissed: false,
  checklistDismissed: false,
  minimized: false,
  completedSteps: [] as string[],
  hasBaby: false,
  hasUpdate: false,
  effectiveSteps: [] as string[],
  allDone: false,
};

async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return identity.subject;
}

async function getOrCreateOnboarding(ctx: MutationCtx, userId: string) {
  const existing = await ctx.db
    .query("userOnboarding")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (existing) {
    return existing;
  }
  const id = await ctx.db.insert("userOnboarding", {
    userId,
    completedSteps: [],
    welcomeDismissed: false,
    checklistDismissed: false,
    minimized: false,
  });
  const doc = await ctx.db.get(id);
  if (!doc) {
    throw new Error("Failed to create onboarding row");
  }
  return doc;
}

async function computeAutoProgress(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<{ hasBaby: boolean; hasUpdate: boolean }> {
  const babies = await ctx.db
    .query("baby")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(20);

  if (babies.length === 0) {
    return { hasBaby: false, hasUpdate: false };
  }

  for (const baby of babies) {
    const update = await ctx.db
      .query("updates")
      .withIndex("by_babyId", (q) => q.eq("babyId", baby._id))
      .first();
    if (update) {
      return { hasBaby: true, hasUpdate: true };
    }
  }

  return { hasBaby: true, hasUpdate: false };
}

function mergeEffectiveSteps(opts: {
  completedSteps: string[];
  hasBaby: boolean;
  hasUpdate: boolean;
}) {
  const set = new Set(opts.completedSteps);
  if (opts.hasBaby) {
    set.add("add_baby");
  }
  if (opts.hasUpdate) {
    set.add("post_update");
  }
  return ONBOARDING_STEP_IDS.filter((id) => set.has(id));
}

function toClientState(
  doc: Doc<"userOnboarding"> | null,
  auto: { hasBaby: boolean; hasUpdate: boolean },
) {
  const completedSteps = doc?.completedSteps ?? [];
  const effectiveSteps = mergeEffectiveSteps({
    completedSteps,
    hasBaby: auto.hasBaby,
    hasUpdate: auto.hasUpdate,
  });
  return {
    welcomeDismissed: doc?.welcomeDismissed ?? false,
    checklistDismissed: doc?.checklistDismissed ?? false,
    minimized: doc?.minimized ?? false,
    completedSteps,
    hasBaby: auto.hasBaby,
    hasUpdate: auto.hasUpdate,
    effectiveSteps,
    allDone: effectiveSteps.length >= ONBOARDING_STEP_IDS.length,
  };
}

/** Current user's onboarding progress (null identity → empty defaults). */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    if (!userId) {
      return emptyState;
    }

    const doc = await ctx.db
      .query("userOnboarding")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const auto = await computeAutoProgress(ctx, userId);
    return toClientState(doc, auto);
  },
});

export const dismissWelcome = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const doc = await getOrCreateOnboarding(ctx, userId);
    await ctx.db.patch(doc._id, { welcomeDismissed: true });
    return null;
  },
});

export const setMinimized = mutation({
  args: { minimized: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const doc = await getOrCreateOnboarding(ctx, userId);
    await ctx.db.patch(doc._id, { minimized: args.minimized });
    return null;
  },
});

export const dismissChecklist = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const doc = await getOrCreateOnboarding(ctx, userId);
    await ctx.db.patch(doc._id, {
      checklistDismissed: true,
      welcomeDismissed: true,
      minimized: true,
    });
    return null;
  },
});

export const completeStep = mutation({
  args: { stepId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!isOnboardingStepId(args.stepId)) {
      throw new Error(`Unknown onboarding step: ${args.stepId}`);
    }
    const doc = await getOrCreateOnboarding(ctx, userId);
    if (doc.completedSteps.includes(args.stepId)) {
      return null;
    }
    await ctx.db.patch(doc._id, {
      completedSteps: [...doc.completedSteps, args.stepId],
      welcomeDismissed: true,
    });
    return null;
  },
});

/** Re-open the tour (welcome + checklist) for users who dismissed it. */
export const restart = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const doc = await getOrCreateOnboarding(ctx, userId);
    await ctx.db.patch(doc._id, {
      welcomeDismissed: false,
      checklistDismissed: false,
      minimized: false,
      // Keep completedSteps so progress isn't wiped — only re-show unfinished tips
    });
    return null;
  },
});

/**
 * Marks the demo user as fully onboarded so preview/local demos aren't
 * interrupted by the first-run tour.
 */
export async function markUserOnboardingComplete(ctx: MutationCtx, userId: string) {
  const existing = await ctx.db
    .query("userOnboarding")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  const patch = {
    completedSteps: [...ONBOARDING_STEP_IDS],
    welcomeDismissed: true,
    checklistDismissed: true,
    minimized: true,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }

  return await ctx.db.insert("userOnboarding", {
    userId,
    ...patch,
  });
}
