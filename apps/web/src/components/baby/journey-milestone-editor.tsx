import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import type {
  BirthJourney,
  MilestoneVisibility,
  PresetBirthJourney,
} from "@workspace/convex/src/types";
import {
  birthJourneyForVisibility,
  milestoneVisibilityForPreset,
} from "@workspace/convex/src/types";
import { useI18n } from "@/lib/i18n";
import { JOURNEY_OPTION_BY_VALUE, JOURNEY_PRESET_OPTIONS } from "./journey-options";
import * as stylex from "@stylexjs/stylex";
import { colors, radius, spacing } from "@workspace/ui/lib/tokens.stylex";

type JourneyMilestoneEditorProps = {
  birthJourney: BirthJourney;
  onBirthJourneyChange: (birthJourney: BirthJourney) => void;
  idPrefix: string;
};

const styles = stylex.create({
  panel: {
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: "1px",
    display: "flex",
    flexDirection: "column",
    gap: spacing.s3,
    padding: spacing.s4,
  },
  row: {
    alignItems: "center",
    cursor: "pointer",
    display: "flex",
    gap: spacing.s3,
    justifyContent: "space-between",
  },
  rowLocked: {
    opacity: 0.7,
  },
});

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
    { value: "custom" as const, label: t("Custom") },
  ];

  function requestVisibilityChange(nextVisibility: MilestoneVisibility) {
    props.onBirthJourneyChange(birthJourneyForVisibility(nextVisibility));
  }

  function handlePresetSelect(preset: PresetBirthJourney) {
    if (preset === props.birthJourney) {
      return;
    }
    requestVisibilityChange(milestoneVisibilityForPreset(preset));
  }

  return (
    <Stack gap="s4">
      <Text size="sm" tone="muted">
        {t("We save this choice for your settings, but we don't show it to anyone.")}
      </Text>

      <Stack gap="s2">
        <Text size="xs" weight="bold" tone="muted">
          {t("Presets")}
        </Text>
        <Select
          items={presetItems}
          value={props.birthJourney}
          onValueChange={(value) => {
            if (value === "labor" || value === "home_birth" || value === "planned_c_section") {
              handlePresetSelect(value);
            }
          }}
        >
          <SelectTrigger aria-label={t("Presets")} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {JOURNEY_PRESET_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Stack>

      <div {...stylex.props(styles.panel)}>
        <Text size="xs" weight="bold" tone="muted">
          {t("Milestones visitors see")}
        </Text>

        <label htmlFor={`${props.idPrefix}-show-labor`} {...stylex.props(styles.row)}>
          <Text as="span" size="sm" weight="medium">
            {t("Labour started")}
          </Text>
          <Switch
            id={`${props.idPrefix}-show-labor`}
            checked={visibility.showLabor}
            onCheckedChange={(checked) => {
              requestVisibilityChange({ ...visibility, showLabor: checked });
            }}
          />
        </label>

        <label htmlFor={`${props.idPrefix}-show-hospital`} {...stylex.props(styles.row)}>
          <Text as="span" size="sm" weight="medium">
            {t("Gone to hospital")}
          </Text>
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
          {...stylex.props(styles.row, styles.rowLocked)}
        >
          <Text as="span" size="sm" weight="medium">
            {t("Baby born")}
          </Text>
          <Switch id={`${props.idPrefix}-show-born`} checked={true} disabled={true} />
        </label>
      </div>

      <Text size="sm" tone="muted">
        {t(JOURNEY_OPTION_BY_VALUE[props.birthJourney].descriptionKey)}
      </Text>
    </Stack>
  );
}
