import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { cn } from "@workspace/ui/lib/utils";
import type { BirthJourney, MilestoneVisibility } from "@workspace/convex/src/types";
import {
  birthJourneyForVisibility,
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

  function requestVisibilityChange(nextVisibility: MilestoneVisibility) {
    props.onBirthJourneyChange(birthJourneyForVisibility(nextVisibility));
  }

  function handlePresetSelect(preset: BirthJourney) {
    if (preset === props.birthJourney) {
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
        <div className="flex flex-wrap gap-2">
          {JOURNEY_PRESET_OPTIONS.map((option) => {
            const selected = props.birthJourney === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                variant={selected ? "default" : "outline"}
                size="sm"
                className={cn("rounded-full font-bold", selected && "pointer-events-none")}
                aria-pressed={selected}
                onClick={() => {
                  handlePresetSelect(option.value);
                }}
              >
                {t(option.labelKey)}
              </Button>
            );
          })}
          {props.birthJourney === "custom" ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="rounded-full font-bold pointer-events-none"
              aria-pressed={true}
            >
              {t("Custom")}
            </Button>
          ) : null}
        </div>
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
