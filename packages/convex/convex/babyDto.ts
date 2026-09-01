import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { milestoneVisibilityForPreset } from "../src/types";
import { loadMilestoneDates } from "./timeline";
import { resolveBabyPreferences } from "./babyPreferences";

async function toBabyBaseDto(ctx: QueryCtx, baby: Doc<"baby">) {
  const [milestoneDates, preferences] = await Promise.all([
    loadMilestoneDates(ctx, baby._id),
    resolveBabyPreferences(ctx.db, baby),
  ]);
  const {
    birthJourney: _birthJourney,
    dueDate: _dueDate,
    dueDateDisplayMode: _dueDateDisplayMode,
    lastActivityAt: _lastActivityAt,
    ownerTokenIdentifier: _ownerTokenIdentifier,
    publicDueDateText: _publicDueDateText,
    subscriptionCount: _subscriptionCount,
    userId: _userId,
    ...publicBaby
  } = baby;
  return {
    ...publicBaby,
    ...milestoneDates,
    ...preferences,
    milestoneVisibility: milestoneVisibilityForPreset(baby.birthJourney),
  };
}

/** Public projection physically omits whichever due-date field is inactive. */
export async function toBabyDto(ctx: QueryCtx, baby: Doc<"baby">) {
  const publicBaby = await toBabyBaseDto(ctx, baby);
  switch (baby.dueDateDisplayMode) {
    case "exact": {
      if (!baby.dueDate) {
        throw new Error("Exact due date display requires a due date");
      }
      return {
        ...publicBaby,
        dueDate: baby.dueDate,
        dueDateDisplayMode: "exact" as const,
      };
    }
    case "message": {
      return {
        ...publicBaby,
        dueDateDisplayMode: "message" as const,
        publicDueDateText: baby.publicDueDateText?.trim(),
      };
    }
  }
}

export async function toManagerBabyDto(ctx: QueryCtx, baby: Doc<"baby">) {
  return {
    ...(await toBabyBaseDto(ctx, baby)),
    birthJourney: baby.birthJourney,
    dueDate: baby.dueDate,
    dueDateDisplayMode: baby.dueDateDisplayMode,
    publicDueDateText: baby.publicDueDateText,
  };
}
