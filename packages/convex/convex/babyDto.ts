import type { Doc } from "./_generated/dataModel";

function toBabyBaseDto(baby: Doc<"baby">) {
  const {
    userId: _userId,
    ownerTokenIdentifier: _ownerTokenIdentifier,
    lastActivityAt: _lastActivityAt,
    subscriptionCount: _subscriptionCount,
    birthJourney: _birthJourney,
    dueDate: _dueDate,
    dueDateDisplayMode: _dueDateDisplayMode,
    publicDueDateText: _publicDueDateText,
    ...publicBaby
  } = baby;
  return publicBaby;
}

/** Public projection physically omits whichever due-date field is inactive. */
export function toBabyDto(baby: Doc<"baby">) {
  const publicBaby = toBabyBaseDto(baby);
  switch (baby.dueDateDisplayMode) {
    case "exact": {
      if (!baby.dueDate) {
        throw new Error("Exact due date display requires a due date");
      }
      return {
        ...publicBaby,
        dueDateDisplayMode: "exact" as const,
        dueDate: baby.dueDate,
      };
    }
    case "message": {
      if (!baby.publicDueDateText) {
        throw new Error("Message due date display requires public text");
      }
      return {
        ...publicBaby,
        dueDateDisplayMode: "message" as const,
        publicDueDateText: baby.publicDueDateText,
      };
    }
  }
}

export function toManagerBabyDto(baby: Doc<"baby">) {
  return {
    ...toBabyBaseDto(baby),
    birthJourney: baby.birthJourney,
    dueDate: baby.dueDate,
    dueDateDisplayMode: baby.dueDateDisplayMode,
    publicDueDateText: baby.publicDueDateText,
  };
}
