import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import type { BirthJourney, MilestoneVisibility } from "@workspace/convex/src/types";
import {
  birthJourneyForVisibility,
  isPresetBirthJourney,
  milestoneVisibilityForPreset,
} from "@workspace/convex/src/types";
import { useI18n } from "@/lib/i18n";
import { JOURNEY_OPTION_BY_VALUE, JOURNEY_PRESET_OPTIONS } from "./journey-options";

type JourneyMilestoneEditorProps = {
  birthJourney: BirthJourney;
  onBirthJourneyChange: (birthJourney: BirthJourney) => void;
  idPrefix: string;
};

/**
 * Controlled journey preset + visitor-milestone toggles.
 * Callers own persistence (settings Save, add-baby form field, etc.).
 */
export function JourneyMilestoneEditor(props: JourneyMilestoneEditorProps) {
  const { t } = useI18n();
  const visibility = milestoneVisibilityForPreset(props.birthJourney);
  const presetItems = [
    ...JOURNEY_PRESET_OPTIONS.map((option) => ({
      value: option.value,
      label: t(option.labelKey),
    })),
    // Included so the closed trigger can show "Custom" when toggles diverge
    { value: "custom" as const, label: t("Custom") },
  ];

  function requestVisibilityChange(nextVisibility: MilestoneVisibility) {
    props.onBirthJourneyChange(birthJourneyForVisibility(nextVisibility));
  }

  function handlePresetSelect(preset: BirthJourney) {
    if (preset === props.birthJourney || !isPresetBirthJourney(preset)) {
      return;
    }
    requestVisibilityChange(milestoneVisibilityForPreset(preset));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("We save this choice for your settings, but we don't show it to anyone.")}
      </p>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("Presets")}
        </p>
        <Select
          items={presetItems}
          value={props.birthJourney}
          onValueChange={(value) => {
            if (value === "labor" || value === "home_birth" || value === "planned_c_section") {
              handlePresetSelect(value);
            }
          }}
        >
          <SelectTrigger aria-label={t("Presets")} size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="w-(--anchor-width)">
            <SelectGroup>
              {JOURNEY_PRESET_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("Milestones visitors see")}
        </p>

        <label
          htmlFor={`${props.idPrefix}-show-labor`}
          className="flex items-center justify-between gap-3"
        >
          <span className="text-sm font-medium">{t("Labour started")}</span>
          <Switch
            id={`${props.idPrefix}-show-labor`}
            checked={visibility.showLabor}
            onCheckedChange={(checked) => {
              requestVisibilityChange({ ...visibility, showLabor: checked });
            }}
          />
        </label>

        <label
          htmlFor={`${props.idPrefix}-show-hospital`}
          className="flex items-center justify-between gap-3"
        >
          <span className="text-sm font-medium">{t("Gone to hospital")}</span>
          <Switch
            id={`${props.idPrefix}-show-hospital`}
            checked={visibility.showHospital}
            onCheckedChange={(checked) => {
              requestVisibilityChange({ ...visibility, showHospital: checked });
            }}
          />
        </label>

        <label
          htmlFor={`${props.idPrefix}-show-born`}
          className="flex items-center justify-between gap-3 opacity-70"
        >
          <span className="text-sm font-medium">{t("Baby born")}</span>
          <Switch id={`${props.idPrefix}-show-born`} checked={true} disabled={true} />
        </label>
      </div>

      <p className="text-sm text-muted-foreground">
        {t(JOURNEY_OPTION_BY_VALUE[props.birthJourney].descriptionKey)}
      </p>
    </div>
  );
}
