import type { BirthJourney, Milestone, NotifiableStatus } from "@workspace/convex/src/types";
import type { TranslationKey } from "@/lib/i18n";

const MILESTONE_LABEL_KEYS = {
  labor_started: "Labour started",
  gone_to_hospital: "Gone to hospital",
  born: "Baby born",
} as const satisfies Record<Milestone, TranslationKey>;

export const NOTIFICATION_LABEL_KEYS = {
  ...MILESTONE_LABEL_KEYS,
  photo_added: "Photo added",
} as const satisfies Record<NotifiableStatus, TranslationKey>;

export function getMilestoneLabelKey(milestone: Milestone, birthJourney: BirthJourney) {
  if (birthJourney === "planned_c_section" && milestone === "gone_to_hospital") {
    return "At hospital" satisfies TranslationKey;
  }
  return MILESTONE_LABEL_KEYS[milestone];
}
