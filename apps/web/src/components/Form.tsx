"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import type { FieldValues, UseFormProps, UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

interface UseZodForm<TInput extends FieldValues> extends UseFormReturn<TInput> {
  id: ReturnType<typeof useId>;
}
/**
 * Reusable hook for zod + react-hook-form
 */
export function useZodForm<TInput extends FieldValues>(
  props: Omit<UseFormProps<TInput>, "resolver"> & {
    schema: z.ZodType<any, TInput>;
  },
): UseZodForm<TInput> {
  const form = useForm<TInput>({
    ...props,
    resolver: zodResolver(props.schema as any, undefined, {
      raw: true,
    }),
  }) as UseZodForm<TInput>;

  form.id = useId();

  return form;
}

export const Form = <TInput extends FieldValues>(props: {
  children: React.ReactNode;
  form: UseZodForm<TInput>;
  handleSubmit: (values: NoInfer<TInput>) => Promise<unknown>;
}) => {
  const { id, ...rest } = props.form;
  return (
    <FormProvider {...rest}>
      <form
        id={id}
        onSubmit={(event) => {
          return rest.handleSubmit(async (values) => {
            try {
              await props.handleSubmit(values);
            } catch (error) {
              console.error("Uncaught error in form", error);
              toast.error(error instanceof Error ? error.message : "Failed to submit form");
            }
          })(event);
        }}
      >
        {props.children}
      </form>
    </FormProvider>
  );
};
