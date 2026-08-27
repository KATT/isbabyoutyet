import { FormControl, FormField, FormItem, useFormField } from "@workspace/ui/components/form";
import { Switch } from "@workspace/ui/components/switch";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import * as stylex from "@stylexjs/stylex";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useI18n } from "@/lib/i18n";
import { spacing } from "@workspace/ui/lib/tokens.stylex";

const styles = stylex.create({
  row: {
    alignItems: "center",
    cursor: "pointer",
    display: "flex",
    gap: spacing.s3,
    justifyContent: "space-between",
    paddingBlockEnd: spacing.s2,
    paddingBlockStart: spacing.s3,
    paddingInline: spacing.s3,
  },
});

type ShowExactDueDateToggleFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  control: Control<TFieldValues, unknown, unknown>;
  name: TName;
};

function ShowExactDueDateToggleRow(props: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { t } = useI18n();
  const fieldIds = useFormField();
  const titleId = `${fieldIds.formItemId}-title`;

  return (
    <label htmlFor={fieldIds.formItemId} {...stylex.props(styles.row)}>
      <Stack gap="s1">
        <Text as="span" id={titleId} size="sm" weight="medium">
          {t("Show exact due date")}
        </Text>
        <Text as="span" id={fieldIds.formDescriptionId} size="sm" tone="muted">
          {props.checked
            ? t("Visitors see the exact date and countdown.")
            : t("Visitors see only your message.")}
        </Text>
      </Stack>
      <FormControl aria-labelledby={titleId}>
        <Switch
          id={fieldIds.formItemId}
          checked={props.checked}
          onCheckedChange={props.onCheckedChange}
        />
      </FormControl>
    </label>
  );
}

export function ShowExactDueDateToggleField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(props: ShowExactDueDateToggleFieldProps<TFieldValues, TName>) {
  return (
    <FormField
      control={props.control}
      name={props.name}
      render={(renderProps) => (
        <FormItem>
          <ShowExactDueDateToggleRow
            checked={renderProps.field.value}
            onCheckedChange={renderProps.field.onChange}
          />
        </FormItem>
      )}
    />
  );
}
