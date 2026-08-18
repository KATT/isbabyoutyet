import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
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
    ...publicBaby
  } = baby;
  return {
    ...publicBaby,
    ...milestoneDates,
  };
}
