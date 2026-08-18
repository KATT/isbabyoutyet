import type { BirthJourney } from "@workspace/convex/src/types";
import type { TranslationKey } from "@/lib/i18n";

export const JOURNEY_OPTIONS = [
  {
    value: "labour",
    labelKey: "Labour",
    descriptionKey: "Visitors see: Labour started → At hospital → Baby born",
  },
  {
    value: "home_birth",
    labelKey: "Home birth",
    descriptionKey: "Visitors see: Labour started → Baby born",
  },
  {
    value: "planned_c_section",
    labelKey: "Planned C-section",
    descriptionKey: "Visitors see: At hospital → Baby born",
  },
] as const satisfies ReadonlyArray<{
  value: BirthJourney;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
}>;
