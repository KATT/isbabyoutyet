import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { ShowExactDueDateToggleField } from "@/components/baby/showExactDueDateToggleField";
import { useI18n } from "@/lib/i18n";

type DueDateDisplayFieldsProps<
  TFieldValues extends FieldValues,
  TDateName extends FieldPath<TFieldValues>,
> = {
  control: Control<TFieldValues, unknown, unknown>;
  dateFieldName: TDateName;
  className: string | undefined;
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
    <div className={cn("overflow-hidden rounded-xl border border-border", props.className)}>
      <ShowExactDueDateToggleField
        control={props.control}
        name={"showExactDueDate" as FieldPath<TFieldValues>}
        rowClassName="gap-3 p-3 pb-2"
        titleClassName={undefined}
      />
      <div className="border-t border-border/60 bg-muted/30 px-3 pb-3 pt-2">
        {showExactDueDate ? (
          <FormField
            control={props.control}
            name={props.dateFieldName}
            render={(renderProps) => (
              <FormItem>
                <FormLabel>{t("Due Date")}</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    aria-label={t("Due Date")}
                    onMouseDown={
                      props.stopPopoverPropagation ? (event) => event.stopPropagation() : undefined
                    }
                    onFocus={
                      props.stopPopoverPropagation ? (event) => event.stopPropagation() : undefined
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
                <FormLabel>{t("Public due date message")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("September baby")} maxLength={80} {...renderProps.field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    </div>
  );
}
