import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { Text } from "@workspace/ui-patterns/components/text";
import { VisuallyHidden } from "@workspace/ui-patterns/components/visually-hidden";
import * as stylex from "@stylexjs/stylex";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { ShowExactDueDateToggleField } from "@/components/baby/showExactDueDateToggleField";
import { useI18n } from "@/lib/i18n";
import { colors, radius, spacing } from "@workspace/ui/lib/tokens.stylex";

const styles = stylex.create({
  root: {
    marginBottom: spacing.s3,
  },
  panel: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: "1px",
    overflow: "hidden",
  },
  nested: {
    backgroundColor: `color-mix(in oklab, ${colors.muted} 30%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.border} 60%, transparent)`,
    borderStyle: "solid",
    borderTopWidth: "1px",
    paddingBlockEnd: spacing.s3,
    paddingBlockStart: spacing.s2,
    paddingInline: spacing.s3,
  },
});

type DueDateDisplayFieldsProps<
  TFieldValues extends FieldValues,
  TDateName extends FieldPath<TFieldValues>,
> = {
  control: Control<TFieldValues, unknown, unknown>;
  dateFieldName: TDateName;
  sectionLabelWeight: "bold" | "normal";
  stopPopoverPropagation: boolean;
};

export function DueDateDisplayFields<
  TFieldValues extends FieldValues & {
    showExactDueDate: boolean;
    publicDueDateText: string;
  },
  TDateName extends FieldPath<TFieldValues>,
>(props: DueDateDisplayFieldsProps<TFieldValues, TDateName>) {
  const { t } = useI18n();
  const showExactDueDate = useWatch({
    control: props.control,
    name: "showExactDueDate" as FieldPath<TFieldValues>,
  });

  return (
    <FormItem {...stylex.props(styles.root)}>
      <Text
        as="div"
        size="sm"
        weight={props.sectionLabelWeight === "bold" ? "bold" : "medium"}
      >
        {t("Due Date")}
      </Text>
      <div {...stylex.props(styles.panel)}>
        <ShowExactDueDateToggleField
          control={props.control}
          name={"showExactDueDate" as FieldPath<TFieldValues>}
        />
        <div {...stylex.props(styles.nested)}>
          {showExactDueDate ? (
            <FormField
              control={props.control}
              name={props.dateFieldName}
              render={(renderProps) => (
                <FormItem>
                  <VisuallyHidden>
                    <FormLabel>{t("Due Date")}</FormLabel>
                  </VisuallyHidden>
                  <FormControl>
                    <Input
                      type="date"
                      onMouseDown={
                        props.stopPopoverPropagation
                          ? (event) => event.stopPropagation()
                          : undefined
                      }
                      onFocus={
                        props.stopPopoverPropagation
                          ? (event) => event.stopPropagation()
                          : undefined
                      }
                      {...renderProps.field}
                      value={renderProps.field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={props.control}
              name={"publicDueDateText" as FieldPath<TFieldValues>}
              render={(renderProps) => (
                <FormItem>
                  <FormLabel>
                    <Text as="span" size="sm" weight="normal" tone="muted">
                      {t("Public due date message")}
                    </Text>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("September baby")}
                      maxLength={80}
                      {...renderProps.field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      </div>
    </FormItem>
  );
}
