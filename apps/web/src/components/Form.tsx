"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Icon } from "@phosphor-icons/react";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { useId, useRef } from "react";
import type { ComponentProps, RefObject } from "react";
import type {
  Control,
  DefaultValues,
  FieldValues,
  UseFormProps,
  UseFormReturn,
} from "react-hook-form";
import { FormProvider, useForm, useFormContext, useFormState } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { useI18n } from "@/lib/i18n";

interface UseZodForm<TInput extends FieldValues, TContext, TOutput> extends UseFormReturn<
  TInput,
  TContext,
  TOutput
> {
  id: ReturnType<typeof useId>;
  formRef: RefObject<HTMLFormElement | null>;
}
/**
 * Reusable hook for zod + react-hook-form
 */
export function useZodForm<TInput extends FieldValues, TContext, TOutput>(
  props: Omit<UseFormProps<TInput, TContext, TOutput>, "resolver" | "defaultValues"> & {
    schema: z.ZodType<TOutput, TInput>;
    defaultValues: DefaultValues<NoInfer<TInput>>;
  },
): UseZodForm<TInput, TContext, TOutput> {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm<TInput, TContext, TOutput>({
    ...props,
    resolver: zodResolver(props.schema) as never,
  });

  return {
    ...form,
    id,
    formRef,
  };
}

const DEV_SUBMIT_DELAY_MS = 500;

export const Form = <TInput extends FieldValues, TContext, TOutput>(props: {
  children: React.ReactNode;
  form: UseZodForm<TInput, TContext, TOutput>;
  handleSubmit: (values: TOutput) => Promise<void>;
}) => {
  const { t } = useI18n();
  const { id, formRef, ...rest } = props.form;
  return (
    <FormProvider {...rest}>
      <form
        id={id}
        ref={formRef}
        onSubmit={(event) => {
          return rest.handleSubmit(async (values) => {
            try {
              if (import.meta.env.DEV) {
                await new Promise((resolve) => setTimeout(resolve, DEV_SUBMIT_DELAY_MS));
              }
              await props.handleSubmit(values);
            } catch (error) {
              console.error("Uncaught error in form", error);
              toast.error(error instanceof Error ? error.message : t("Failed to submit form"));
            }
          })(event);
        }}
      >
        {props.children}
      </form>
    </FormProvider>
  );
};

/** Phosphor icon component, or a single glyph/emoji (e.g. `"🍼"`). */
type SubmitIcon = Icon | string;

type SubmitTargetForm<TFieldValues extends FieldValues> = {
  id: string;
  control: Control<TFieldValues>;
};

/**
 * Submit control wired to the nearest {@link Form} context (or an explicit `form`).
 * Keeps the label; swaps `IconComponent` for a spinner while submitting.
 *
 * Uses {@link useFormState} so React Compiler still re-renders on `isSubmitting`
 * (reading `form.formState.isSubmitting` via the Proxy is not a reliable subscription).
 *
 * @see https://github.com/trpc/examples-kitchen-sink/blob/main/src/feature/react-hook-form/Form.tsx
 */
export function SubmitButton<TFieldValues extends FieldValues>(
  props: Omit<ComponentProps<typeof Button>, "type" | "form"> & {
    /**
     * Form to submit, or `"context"` to use the nearest {@link Form} provider.
     * A concrete form sets the HTML `form` attribute to that form's id (useful outside the `<form>`).
     */
    form: SubmitTargetForm<TFieldValues> | "context";
    /** Idle icon (Phosphor component or one glyph/emoji); replaced by a spinner while submitting. */
    IconComponent: SubmitIcon;
    /** Whether the icon/spinner sits before (`start`) or after (`end`) the label. */
    iconPosition: "start" | "end";
  },
) {
  const context = useFormContext();
  const form = props.form === "context" ? context : props.form;
  // Subscribe through the hook — do not read `form.formState.isSubmitting` directly
  // (RHF Proxy + React Compiler often skips re-renders).
  const { isSubmitting } = useFormState(
    props.form === "context"
      ? {}
      : // RHF Control is invariant; cast so useFormState accepts any field map.
        { control: props.form.control as Control<FieldValues> },
  );
  if (!form) {
    throw new Error("SubmitButton must be used within a Form or have a form prop");
  }

  const {
    form: formProp,
    IconComponent,
    iconPosition,
    disabled,
    children,
    ...buttonProps
  } = props;

  const icon = (
    <span className="relative inline-grid size-4 shrink-0 place-items-center" aria-hidden="true">
      {isSubmitting ? (
        <span className="submit-icon-swap-in inline-grid place-items-center">
          <Spinner className="size-4" />
        </span>
      ) : typeof IconComponent === "string" ? (
        <span className="text-base leading-none">{IconComponent}</span>
      ) : (
        <IconComponent className="size-4" />
      )}
    </span>
  );

  return (
    <Button
      {...buttonProps}
      form={formProp === "context" ? undefined : formProp.id}
      type="submit"
      aria-busy={isSubmitting}
      disabled={isSubmitting || Boolean(disabled)}
    >
      {iconPosition === "start" ? icon : null}
      {children}
      {iconPosition === "end" ? icon : null}
    </Button>
  );
}
