import * as React from "react";
import { useRender } from "@base-ui/react/use-render";
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import * as stylex from "@stylexjs/stylex";

import { colors } from "@workspace/ui/lib/tokens.stylex";
import { Label } from "@workspace/ui/components/label";

const Form = FormProvider;

const styles = stylex.create({
  description: {
    color: colors.mutedForeground,
    fontSize: "0.875rem",
  },
  item: {
    display: "grid",
    gap: "0.5rem",
  },
  message: {
    color: colors.destructive,
    fontSize: "0.875rem",
  },
});

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TTransformedValues = TFieldValues,
>(
  props: ControllerProps<TFieldValues, TName, TTransformedValues>,
) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

export type FormItemProps = Omit<React.ComponentProps<"div">, "className" | "style">;

function FormItem(props: FormItemProps) {
  const id = React.useId();
  const stylexProps = stylex.props(styles.item);

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        data-slot="form-item"
        {...props}
        className={stylexProps.className}
        style={stylexProps.style}
      />
    </FormItemContext.Provider>
  );
}

export type FormLabelProps = React.ComponentProps<typeof Label>;

function FormLabel(props: FormLabelProps) {
  const { error, formItemId } = useFormField();

  return <Label data-slot="form-label" data-error={!!error} htmlFor={formItemId} {...props} />;
}

function FormControl(
  allProps: React.HTMLAttributes<HTMLElement> & { children: React.ReactElement },
) {
  const { children, ...props } = allProps;
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  return useRender({
    render: children,
    props: {
      "data-slot": "form-control",
      id: formItemId,
      "aria-describedby": !error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`,
      "aria-invalid": !!error,
      ...props,
    },
  });
}

export type FormDescriptionProps = Omit<React.ComponentProps<"p">, "className" | "style">;

function FormDescription(props: FormDescriptionProps) {
  const { formDescriptionId } = useFormField();
  const stylexProps = stylex.props(styles.description);

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      {...props}
      className={stylexProps.className}
      style={stylexProps.style}
    />
  );
}

export type FormMessageProps = Omit<React.ComponentProps<"p">, "className" | "style">;

function FormMessage(props: FormMessageProps) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? "") : props.children;
  const stylexProps = stylex.props(styles.message);

  if (!body) {
    return null;
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      {...props}
      className={stylexProps.className}
      style={stylexProps.style}
    >
      {body}
    </p>
  );
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
};
