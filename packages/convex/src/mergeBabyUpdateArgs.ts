import type { Id } from "../convex/_generated/dataModel";
import type { SupportedLocale } from "./i18n";
import type { BirthJourney } from "./types";

export type BabyUpdateSource = {
  dueDate: string | null;
  dueDateDisplayMode: "exact" | "message";
  publicDueDateText: string | null;
  name: string;
  birthJourney: BirthJourney;
} & Partial<{
  theme: string | null;
  locale: SupportedLocale | null;
}>;

export type BabyUpdatePatch = {
  babyId: Id<"baby">;
} & Partial<BabyUpdateSource>;

/** Merge a stored baby with a sparse UI patch into required `baby.update` args. */
export function mergeBabyUpdateArgs(opts: { baby: BabyUpdateSource; patch: BabyUpdatePatch }) {
  const baby = opts.baby;
  const patch = opts.patch;
  return {
    babyId: patch.babyId,
    dueDate: patch.dueDate !== undefined ? patch.dueDate : baby.dueDate,
    dueDateDisplayMode:
      patch.dueDateDisplayMode !== undefined ? patch.dueDateDisplayMode : baby.dueDateDisplayMode,
    publicDueDateText:
      patch.publicDueDateText !== undefined ? patch.publicDueDateText : baby.publicDueDateText,
    name: patch.name !== undefined ? patch.name : baby.name,
    theme: patch.theme !== undefined ? patch.theme : (baby.theme ?? null),
    locale: patch.locale !== undefined ? patch.locale : (baby.locale ?? null),
    birthJourney: patch.birthJourney !== undefined ? patch.birthJourney : baby.birthJourney,
  };
}
