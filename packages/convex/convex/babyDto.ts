import type { Doc } from "./_generated/dataModel";

export function toBabyDto(baby: Doc<"baby">) {
  const {
    userId: _userId,
    ownerTokenIdentifier: _ownerTokenIdentifier,
    lastActivityAt: _lastActivityAt,
    subscriptionCount: _subscriptionCount,
    birthJourney: _birthJourney,
    ...publicBaby
  } = baby;
  return publicBaby;
}
