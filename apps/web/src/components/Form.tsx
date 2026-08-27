"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Icon } from "@phosphor-icons/react";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  createContext,
  useContext,
  useId,
  useRef,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
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

/** Counted so overlapping submits from sibling forms keep the overlay lock held. */
type FormSubmitLock = {
  acquire: () => void;
  release: () => void;
};

const FormSubmitLockContext = createContext<FormSubmitLock | null>(null);

/**
 * Whether a Base UI overlay close attempt should be cancelled while a form submits.
 * Allows `imperative-action` so success closes from inside `handleSubmit` still work
 * (they fire while `isSubmitting` is still true).
 */
export function shouldBlockOverlayDismiss(opts: {
  isLocked: boolean;
  open: boolean;
  reason: string;
}) {
  return !opts.open && opts.isLocked && opts.reason !== "imperative-action";
}

/** Structural subset of Base UI Root ChangeEventDetails (popover / dialog / alert-dialog). */
type OverlayDismissEventDetails = {
  reason: string;
  cancel: () => void;
};

type OverlayOpenChangeHandler = (
  open: boolean,
  eventDetails: OverlayDismissEventDetails,
) => void;

/** Identical shape across Popover / Dialog / AlertDialog Root.Actions. */
type OverlayActions = {
  close: () => void;
  unmount: () => void;
};

export type FormOverlayHandle = {
  /** Close the overlay. Safe mid-submit: reports `imperative-action`, which the guard allows. */
  close: () => void;
  /** Spread onto the Base UI Root (`Popover` / `Dialog` / `AlertDialog` / `Sheet`). */
  rootProps: {
    actionsRef: RefObject<OverlayActions | null>;
    onOpenChange: OverlayOpenChangeHandler;
  };
  /** @internal consumed by {@link FormOverlayProvider}. */
  lock: FormSubmitLock;
};

/**
 * Overlay that hosts {@link Form}s: owns the actions ref and a submit lock.
 * While any child form submits, user dismissal (escape, outside press, close
 * buttons, trigger toggle) is cancelled; the imperative success-close is not.
 */
export function useFormOverlay(opts: {
  /** Extra open-change logic (e.g. DueDateEditor's date-picker cancel); pass `undefined` otherwise. */
  onOpenChange: OverlayOpenChangeHandler | undefined;
}): FormOverlayHandle {
  const actionsRef = useRef<OverlayActions | null>(null);
  const pendingSubmitsRef = useRef(0);

  return {
    close: () => {
      actionsRef.current?.close();
    },
    lock: {
      acquire: () => {
        pendingSubmitsRef.current += 1;
      },
      release: () => {
        pendingSubmitsRef.current -= 1;
      },
    },
    rootProps: {
      actionsRef,
      onOpenChange: (open, eventDetails) => {
        if (
          shouldBlockOverlayDismiss({
            isLocked: pendingSubmitsRef.current > 0,
            open,
            reason: eventDetails.reason,
          })
        ) {
          eventDetails.cancel();
          // Do not forward — critical for controlled roots (Sheet) whose
          // consumer would otherwise set open=false despite cancel().
          return;
        }
        opts.onOpenChange?.(open, eventDetails);
      },
    },
  };
}

/** Wrap the overlay's content so child {@link Form}s register submits with the lock. */
export function FormOverlayProvider(props: {
  overlay: FormOverlayHandle;
  children: ReactNode;
}) {
  return (
    <FormSubmitLockContext.Provider value={props.overlay.lock}>
      {props.children}
    </FormSubmitLockContext.Provider>
  );
}

export const Form = <TInput extends FieldValues, TContext, TOutput>(props: {
  children: React.ReactNode;
  form: UseZodForm<TInput, TContext, TOutput>;
  handleSubmit: (values: TOutput) => Promise<void>;
}) => {
  const { t } = useI18n();
  const lock = useContext(FormSubmitLockContext);
  const { id, formRef, ...rest } = props.form;
  return (
    <FormProvider {...rest}>
      <form
        id={id}
        ref={formRef}
        onSubmit={(event) => {
          return rest.handleSubmit(async (values) => {
            lock?.acquire();
            try {
              if (import.meta.env.DEV) {
                await new Promise((resolve) => setTimeout(resolve, DEV_SUBMIT_DELAY_MS));
              }
              await props.handleSubmit(values);
            } catch (error) {
              console.error("Uncaught error in form", error);
              toast.error(error instanceof Error ? error.message : t("Failed to submit form"));
            } finally {
              lock?.release();
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
  const { isSubmitting } = useFormState(
    props.form === "context"
      ? {}
      : { control: props.form.control as Control<FieldValues> },
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

  const { form: formProp, IconComponent, iconPosition, disabled, children, ...buttonProps } = props;

  const showIcon = IconComponent != null || isSubmitting;
  const icon = showIcon ? (
    <span className="relative inline-grid size-4 shrink-0 place-items-center" aria-hidden="true">
      {isSubmitting ? (
        <span className="submit-icon-swap-in inline-grid place-items-center">
          <Spinner className="size-4" />
        </span>
      ) : typeof IconComponent === "string" ? (
        <span className="text-base leading-none">{IconComponent}</span>
      ) : IconComponent ? (
        <IconComponent className="size-4" />
      ) : null}
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
