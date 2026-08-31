"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Icon } from "@phosphor-icons/react";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { useId, useRef, type ComponentProps, type ReactNode, type RefObject } from "react";
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
import { isString } from "@workspace/runtime/guards";
import { useI18n } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import {
  FormGuardContextProvider,
  useFormNavigationGuard,
  useFormGuardStack,
  useRegisterFormState,
  type FormGuardHandle,
} from "@workspace/form-guard";

export {
  shouldBlockOverlayDismiss,
  useFormGuard,
  type FormGuardHandle,
} from "@workspace/form-guard";

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
    resolver: zodResolver<TInput, TContext, TOutput>(props.schema),
  });

  return {
    ...form,
    id,
    formRef,
  };
}

const DEV_SUBMIT_DELAY_MS = 500;

/** Wrap form content so child {@link Form}s register submits and dirty state. */
export function FormGuardProvider(props: { guard: FormGuardHandle; children: ReactNode }) {
  // Dirty state bubbles to the stack root, which hosts the single discard
  // prompt and navigation blocker; nested providers only relay to it.
  const isStackRoot = useFormGuardStack().length === 0;
  return (
    <FormGuardContextProvider guard={props.guard}>
      {props.children}
      {isStackRoot ? (
        <FormDiscardHostWithRouter guard={props.guard} />
      ) : (
        <FormDiscardDialog guard={props.guard} navigation={null} />
      )}
    </FormGuardContextProvider>
  );
}

function FormDiscardHostWithRouter(props: { guard: FormGuardHandle }) {
  const navigation = useFormNavigationGuard(props.guard);
  return <FormDiscardDialog guard={props.guard} navigation={navigation} />;
}

type NavigationGuard = ReturnType<typeof useFormNavigationGuard>;

function FormDiscardDialog(props: { guard: FormGuardHandle; navigation: NavigationGuard | null }) {
  const { t } = useI18n();
  const navigation = props.navigation;
  const discardingRef = useRef(false);
  const blocked = navigation?.status === "blocked";
  const open = props.guard.discardPrompt.open || blocked;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen || discardingRef.current) {
          return;
        }
        props.guard.discardPrompt.onOpenChange(false);
        if (navigation?.status === "blocked") {
          navigation.reset();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Discard unsaved changes?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("If you close now, your edits will be lost.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Keep editing")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              discardingRef.current = true;
              props.guard.discardPrompt.onDiscard();
              if (navigation?.status === "blocked") {
                navigation.proceed();
              }
            }}
          >
            {t("Discard")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const Form = <TInput extends FieldValues, TContext, TOutput>(props: {
  children: ReactNode;
  form: UseZodForm<TInput, TContext, TOutput>;
  handleSubmit: (values: TOutput) => Promise<void>;
}) => {
  const { t } = useI18n();
  const formState = useFormState({ control: props.form.control });
  // The guard consumes reactive form state — no imperative submit lock:
  // `isSubmitting` blocks user dismissal, and a failed submit re-arms the
  // unsaved-edits guard on its own (`isSubmitSuccessful` stays false).
  useRegisterFormState({
    isDirty: formState.isDirty,
    isSubmitting: formState.isSubmitting,
    isSubmitSuccessful: formState.isSubmitSuccessful,
  });
  const { id, formRef, ...rest } = props.form;
  return (
    <FormProvider {...rest}>
      <form
        id={id}
        ref={formRef}
        onSubmit={(event) => {
          // Errors propagate through RHF's handleSubmit so `isSubmitSuccessful`
          // reflects the real outcome; the outer catch only reports them.
          return rest
            .handleSubmit(async (values) => {
              // Dev-only pause so submit spinners are visible while clicking around locally.
              /* v8 ignore next 3 */
              if (import.meta.env.DEV) {
                await new Promise((resolve) => setTimeout(resolve, DEV_SUBMIT_DELAY_MS));
              }
              await props.handleSubmit(values);
            })(event)
            .catch((error) => {
              console.error("Uncaught error in form", error);
              toast.error(error instanceof Error ? error.message : t("Failed to submit form"));
            });
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

type CancelTargetForm<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
};

/**
 * Cancel control disabled while its form submits. Compose into the overlay's
 * close primitive: `<PopoverClose render={<FormCancelButton form="context" … />}>`.
 *
 * Uses {@link useFormState} so React Compiler still re-renders on `isSubmitting`.
 */
export function FormCancelButton<TFieldValues extends FieldValues>(
  props: Omit<ComponentProps<typeof Button>, "type" | "form"> & {
    /** Form whose submit disables this button, or `"context"` for the nearest {@link Form}. */
    form: CancelTargetForm<TFieldValues> | "context";
  },
) {
  const { isSubmitting } = useFormState<TFieldValues>(
    props.form === "context" ? {} : { control: props.form.control },
  );
  const { form: _form, disabled, variant, ...buttonProps } = props;
  return (
    <Button
      {...buttonProps}
      type="button"
      variant={variant ?? "outline"}
      disabled={isSubmitting || Boolean(disabled)}
    />
  );
}

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
    /**
     * Idle icon (Phosphor component or one glyph/emoji); replaced by a spinner while
     * submitting. Pass `null` for label-only actions (e.g. theme swatches, dialog confirms).
     */
    IconComponent: SubmitIcon | null;
    /** Whether the icon/spinner sits before (`start`) or after (`end`) the label. */
    iconPosition: "start" | "end";
  },
) {
  const context = useFormContext();
  const form = props.form === "context" ? context : props.form;
  if (!form) {
    throw new Error("SubmitButton must be used within a Form or have a form prop");
  }
  // Subscribe through the hook — do not read `form.formState.isSubmitting` directly
  // (RHF Proxy + React Compiler often skips re-renders).
  const { isSubmitting } = useFormState<TFieldValues>(
    props.form === "context" ? {} : { control: props.form.control },
  );

  const { form: formProp, IconComponent, iconPosition, disabled, children, ...buttonProps } = props;

  const showIcon = IconComponent != null || isSubmitting;
  const icon = showIcon ? (
    <span className="relative inline-grid size-4 shrink-0 place-items-center" aria-hidden="true">
      {isSubmitting ? (
        <span className="submit-icon-swap-in inline-grid place-items-center">
          <Spinner className="size-4" />
        </span>
      ) : isString(IconComponent) ? (
        <span className="text-base leading-none">{IconComponent}</span>
      ) : IconComponent == null ? null : (
        <IconComponent className="size-4" />
      )}
    </span>
  ) : null;

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
