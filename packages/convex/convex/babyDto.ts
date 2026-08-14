import type { Doc } from "./_generated/dataModel";

export function toBabyDto(baby: Doc<"baby">) {
  const {
    userId: _userId,
    ownerTokenIdentifier: _ownerTokenIdentifier,
    lastActivityAt: _lastActivityAt,
    subscriptionCount: _subscriptionCount,
    ...publicBaby
  } = baby;
  return publicBaby;
}
