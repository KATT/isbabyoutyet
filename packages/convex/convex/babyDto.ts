import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { milestoneVisibilityForPreset } from "../src/types";
import { loadMilestoneDates } from "./timeline";

export async function toBabyDto(ctx: QueryCtx, baby: Doc<"baby">) {
  const milestoneDates = await loadMilestoneDates(ctx, baby._id);
  const {
    userId: _userId,
    ownerTokenIdentifier: _ownerTokenIdentifier,
    lastActivityAt: _lastActivityAt,
    subscriptionCount: _subscriptionCount,
    laborStarted: _laborStarted,
    wentToHospital: _wentToHospital,
    babyBorn: _babyBorn,
    laborStartedMessage: _laborStartedMessage,
    hospitalMessage: _hospitalMessage,
    babyBornMessage: _babyBornMessage,
    birthJourney: _birthJourney,
    ...publicBaby
  } = baby;
  return {
    ...publicBaby,
    ...milestoneDates,
    milestoneVisibility: milestoneVisibilityForPreset(baby.birthJourney),
  };
}

export async function toManagerBabyDto(ctx: QueryCtx, baby: Doc<"baby">) {
  return { ...(await toBabyDto(ctx, baby)), birthJourney: baby.birthJourney };
}
