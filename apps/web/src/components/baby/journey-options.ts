import type { BirthJourney, PresetBirthJourney } from "@workspace/convex/src/types";
import type { TranslationKey } from "@/lib/i18n";

export const JOURNEY_PRESET_OPTIONS = [
  {
    value: "labor",
    labelKey: "Labour",
    descriptionKey: "Visitors see: Labour started → Gone to hospital → Baby born",
  },
  {
    value: "home_birth",
    labelKey: "Home birth",
    descriptionKey: "Visitors see: Labour started → Baby born",
  },
  {
    value: "planned_c_section",
    labelKey: "Planned C-section",
    descriptionKey: "Visitors see: Gone to hospital → Baby born",
  },
] as const satisfies ReadonlyArray<{
  value: PresetBirthJourney;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
}>;

export const JOURNEY_OPTION_BY_VALUE = {
  labor: JOURNEY_PRESET_OPTIONS[0],
  home_birth: JOURNEY_PRESET_OPTIONS[1],
  planned_c_section: JOURNEY_PRESET_OPTIONS[2],
  custom: {
    value: "custom",
    labelKey: "Custom",
    descriptionKey: "Visitors see: Baby born",
  },
} as const satisfies Record<
  BirthJourney,
  {
    value: BirthJourney;
    labelKey: TranslationKey;
    descriptionKey: TranslationKey;
  }
>;
