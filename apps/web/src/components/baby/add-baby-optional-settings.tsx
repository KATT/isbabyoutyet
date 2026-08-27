import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Button } from "@workspace/ui/components/button";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { Inline } from "@workspace/ui-patterns/components/inline";
import { CaretDown } from "@phosphor-icons/react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useI18n } from "@/lib/i18n";
import { JourneyMilestoneEditor } from "./journey-milestone-editor";
import { THEME_OPTIONS } from "./utils";
import * as stylex from "@stylexjs/stylex";
import { colors, radius, spacing } from "@workspace/ui/lib/tokens.stylex";

type AddBabyOptionalSettingsProps<
  TFieldValues extends FieldValues,
  TBirthJourneyName extends FieldPath<TFieldValues>,
  TThemeName extends FieldPath<TFieldValues>,
> = {
  control: Control<TFieldValues, unknown, unknown>;
  birthJourneyFieldName: TBirthJourneyName;
  themeFieldName: TThemeName;
};

const styles = stylex.create({
  shell: {
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: "2px",
    overflow: "hidden",
  },
  trigger: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderStyle: "none",
    cursor: "pointer",
    display: "flex",
    fontWeight: 700,
    gap: spacing.s3,
    justifyContent: "space-between",
    paddingBlock: spacing.s3,
    paddingInline: spacing.s4,
    textAlign: "left",
    width: "100%",
  },
  caret: {
    flexShrink: 0,
    height: "1rem",
    transition: "transform 0.15s",
    width: "1rem",
  },
  content: {
    paddingBottom: spacing.s4,
    paddingInline: spacing.s4,
    paddingTop: spacing.s1,
  },
  swatch: {
    borderColor: `color-mix(in oklab, ${colors.border} 50%, transparent)`,
    borderRadius: radius.sm,
    borderStyle: "solid",
    borderWidth: "1px",
    height: "1rem",
    width: "1rem",
  },
  themeGrid: {
    display: "grid",
    gap: spacing.s2,
  },
});

export function AddBabyOptionalSettings<
  TFieldValues extends FieldValues,
  TBirthJourneyName extends FieldPath<TFieldValues>,
  TThemeName extends FieldPath<TFieldValues>,
>(props: AddBabyOptionalSettingsProps<TFieldValues, TBirthJourneyName, TThemeName>) {
  const { t } = useI18n();

  return (
    <div {...stylex.props(styles.shell)}>
      <Collapsible>
        <CollapsibleTrigger>
          <span {...stylex.props(styles.trigger)}>
            <span>{t("Customize your page (optional)")}</span>
            <CaretDown {...stylex.props(styles.caret)} />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div {...stylex.props(styles.content)}>
            <Stack gap="s5">
              <Text size="sm" tone="muted">
                {t(
                  "You can change journey, theme, and other settings anytime after creating your page.",
                )}
              </Text>

              <FormField
                control={props.control}
                name={props.birthJourneyFieldName}
                render={(renderProps) => (
                  <FormItem>
                    <FormLabel>{t("Birth journey")}</FormLabel>
                    <FormControl>
                      <JourneyMilestoneEditor
                        birthJourney={renderProps.field.value}
                        idPrefix="add-journey"
                        onBirthJourneyChange={renderProps.field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={props.control}
                name={props.themeFieldName}
                render={(renderProps) => (
                  <FormItem>
                    <FormLabel>{t("Theme")}</FormLabel>
                    <FormControl>
                      <div {...stylex.props(styles.themeGrid)}>
                        {THEME_OPTIONS.map((option) => {
                          const selected = renderProps.field.value === option.value;
                          return (
                            <Button
                              key={option.value ?? "default"}
                              type="button"
                              variant={selected ? "default" : "outline"}
                              aria-pressed={selected}
                              onClick={() => {
                                renderProps.field.onChange(option.value);
                              }}
                            >
                              <Inline gap="s1" wrap={false}>
                                {option.colors.map((color, index) => (
                                  <span
                                    key={index}
                                    {...stylex.props(styles.swatch)}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </Inline>
                              {t(option.labelKey)}
                            </Button>
                          );
                        })}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Stack>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
