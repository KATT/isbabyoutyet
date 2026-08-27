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
import { Inline } from "@workspace/ui-patterns/components/inline";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { CaretDown } from "@phosphor-icons/react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import * as stylex from "@stylexjs/stylex";
import { useI18n } from "@/lib/i18n";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";
import { JourneyMilestoneEditor } from "./journey-milestone-editor";
import { THEME_OPTIONS } from "./utils";

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
    borderRadius: "1rem",
    borderStyle: "solid",
    borderWidth: "2px",
    overflow: "hidden",
  },
  trigger: {
    backgroundColor: {
      ":hover": `color-mix(in oklab, ${colors.muted} 40%, transparent)`,
      default: "transparent",
    },
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
    borderBottomWidth: {
      default: 0,
      ":is([data-panel-open])": "1px",
    },
    cursor: "pointer",
    display: "block",
    paddingBlock: spacing.s3,
    paddingInline: spacing.s4,
    textAlign: "start",
    width: "100%",
  },
  caret: {
    flexShrink: 0,
    transform: {
      default: "rotate(0deg)",
      // Matches when this node is a descendant of the open trigger.
      ":is([data-panel-open] *)": "rotate(180deg)",
    },
    transitionDuration: "150ms",
    transitionProperty: "transform",
    transitionTimingFunction: "ease",
  },
  content: {
    paddingBlockEnd: spacing.s4,
    paddingBlockStart: spacing.s1,
    paddingInline: spacing.s4,
  },
  themeGrid: {
    display: "grid",
    gap: spacing.s2,
  },
  swatchRow: {
    display: "flex",
    gap: "0.125rem",
  },
  swatch: {
    borderColor: `color-mix(in oklab, ${colors.border} 50%, transparent)`,
    borderRadius: "0.125rem",
    borderStyle: "solid",
    borderWidth: "1px",
    height: "1rem",
    width: "1rem",
  },
  themeButton: {
    justifyContent: "flex-start",
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
        <CollapsibleTrigger render={<button type="button" {...stylex.props(styles.trigger)} />}>
          <Inline gap="s3" justify="between" wrap={false} fullWidth>
            <Text as="span" weight="bold">
              {t("Customize your page (optional)")}
            </Text>
            <CaretDown size={16} {...stylex.props(styles.caret)} />
          </Inline>
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
                              shape="pill"
                              aria-pressed={selected}
                              onClick={() => {
                                renderProps.field.onChange(option.value);
                              }}
                            >
                              <span {...stylex.props(styles.swatchRow)}>
                                {option.colors.map((color, index) => (
                                  <span
                                    key={index}
                                    {...stylex.props(styles.swatch)}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </span>
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
