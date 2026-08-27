import type { StyleXStyles } from "@stylexjs/stylex";
import * as stylex from "@stylexjs/stylex";
import { useMemo } from "react";

import { colors } from "@workspace/ui/lib/tokens.stylex";
import { Label } from "@workspace/ui/components/label";
import { Separator } from "@workspace/ui/components/separator";

const styles = stylex.create({
  content: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
    gap: "0.375rem",
    lineHeight: 1.375,
  },
  description: {
    color: colors.mutedForeground,
    fontSize: "0.875rem",
    fontWeight: 400,
    lineHeight: 1.5,
  },
  error: {
    color: colors.destructive,
    fontSize: "0.875rem",
    fontWeight: 400,
  },
  errorList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  fieldBase: {
    display: "flex",
    gap: "0.75rem",
    width: "100%",
  },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: "1.75rem",
    width: "100%",
  },
  horizontal: {
    alignItems: "center",
    flexDirection: "row",
  },
  label: {
    alignItems: "center",
    display: "flex",
    gap: "0.5rem",
    lineHeight: 1.375,
    width: "fit-content",
  },
  legend: {
    fontWeight: 500,
    marginBottom: "0.75rem",
  },
  legendLabel: {
    fontSize: "0.875rem",
  },
  legendLegend: {
    fontSize: "1rem",
  },
  responsive: {
    alignItems: { "@media (min-width: 768px)": "center", default: null },
    flexDirection: { "@media (min-width: 768px)": "row", default: "column" },
  },
  separator: {
    alignItems: "center",
    display: "flex",
    fontSize: "0.875rem",
    height: "1.25rem",
    justifyContent: "center",
    marginBlock: "-0.5rem",
    position: "relative",
  },
  separatorContent: {
    backgroundColor: colors.background,
    color: colors.mutedForeground,
    display: "block",
    marginInline: "auto",
    paddingInline: "0.5rem",
    position: "relative",
    width: "fit-content",
  },
  separatorLine: {
    insetInline: 0,
    position: "absolute",
    top: "50%",
  },
  set: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  title: {
    alignItems: "center",
    display: "flex",
    fontSize: "0.875rem",
    fontWeight: 500,
    gap: "0.5rem",
    lineHeight: 1.375,
    width: "fit-content",
  },
  vertical: {
    flexDirection: "column",
  },
});

type FieldOrientation = "vertical" | "horizontal" | "responsive";

const orientationStyles: Record<FieldOrientation, StyleXStyles> = {
  horizontal: styles.horizontal,
  responsive: styles.responsive,
  vertical: styles.vertical,
};

const FieldSet = ({ ...props }: Omit<React.ComponentProps<"fieldset">, "className" | "style">) => (
  <fieldset
    {...stylex.props(styles.set)}
    data-slot="field-set"
    {...props}
  />
);

const FieldLegend = ({ variant = "legend",
  ...props
}: Omit<React.ComponentProps<"legend">, "className" | "style"> & { variant?: "legend" | "label" }) => (
  <legend
    {...stylex.props(
      styles.legend,
      variant === "label" ? styles.legendLabel : styles.legendLegend
    )}
    data-slot="field-legend"
    data-variant={variant}
    {...props}
  />
);

const FieldGroup = ({ ...props }: Omit<React.ComponentProps<"div">, "className" | "style">) => (
  <div
    {...stylex.props(styles.group)}
    data-slot="field-group"
    {...props}
  />
);

const Field = ({ orientation = "vertical",
  ...props
}: Omit<React.ComponentProps<"div">, "className" | "style"> & { orientation?: FieldOrientation }) => (
  <div
    {...stylex.props(
      styles.fieldBase,
      orientationStyles[orientation]
    )}
    data-orientation={orientation}
    data-slot="field"
    role="group"
    {...props}
  />
);

const FieldContent = ({ ...props }: Omit<React.ComponentProps<"div">, "className" | "style">) => (
  <div
    {...stylex.props(styles.content)}
    data-slot="field-content"
    {...props}
  />
);

const FieldLabel = (props: React.ComponentProps<typeof Label>) => (
  <Label data-slot="field-label" {...props} />
);

const FieldTitle = ({ ...props }: Omit<React.ComponentProps<"div">, "className" | "style">) => (
  <div
    {...stylex.props(styles.title)}
    data-slot="field-label"
    {...props}
  />
);

const FieldDescription = ({ ...props }: Omit<React.ComponentProps<"p">, "className" | "style">) => (
  <p
    {...stylex.props(styles.description)}
    data-slot="field-description"
    {...props}
  />
);

const FieldSeparator = ({
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "className" | "style">) => {
  const line = stylex.props(styles.separatorLine);
  const content = stylex.props(styles.separatorContent);
  return (
    <div
      {...stylex.props(styles.separator)}
      data-content={Boolean(children)}
      data-slot="field-separator"
      {...props}
    >
      <div className={line.className} style={line.style} data-slot="field-separator-line">
        <Separator />
      </div>
      {children ? (
        <span
          className={content.className}
          data-slot="field-separator-content"
          style={content.style}
        >
          {children}
        </span>
      ) : null}
    </div>
  );
};

const FieldError = ({ children,
  errors,
  ...props
}: Omit<React.ComponentProps<"div">, "className" | "style"> & {
  errors?: ({ message?: string } | undefined)[];
}) => {
  const content = useMemo(() => {
    if (children) {
      return children;
    }
    if (!errors?.length) {
      return null;
    }
    const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()];
    if (uniqueErrors.length === 1) {
      return uniqueErrors[0]?.message;
    }
    const list = stylex.props(styles.errorList);
    return (
      <ul className={list.className} style={list.style}>
        {uniqueErrors.map((error) =>
          error?.message ? <li key={error.message}>{error.message}</li> : null,
        )}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }
  return (
    <div
      {...stylex.props(styles.error)}
      data-slot="field-error"
      role="alert"
      {...props}
    >
      {content}
    </div>
  );
};

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
};
