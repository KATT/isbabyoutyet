import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui-cssinjs/components/form";
import { Input } from "@workspace/ui-cssinjs/components/input";
import { Label } from "@workspace/ui-cssinjs/components/label";
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
  sectionLabelClassName: string | undefined;
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
    <FormItem className={props.className}>
      <Label className={props.sectionLabelClassName}>{t("Due Date")}</Label>
      <div className="overflow-hidden rounded-xl border border-border">
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
                  <FormLabel className="sr-only">{t("Due Date")}</FormLabel>
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
                  <FormLabel className="text-sm font-normal text-muted-foreground">
                    {t("Public due date message")}
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
