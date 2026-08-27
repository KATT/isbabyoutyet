import type { ComponentProps } from "react";
import type { StyleXStyles } from "@stylexjs/stylex";
import * as stylex from "@stylexjs/stylex";

import { colors, radius } from "@workspace/ui/lib/tokens.stylex";

const styles = stylex.create({
  action: {
    alignSelf: "start",
    gridColumnStart: "2",
    gridRowEnd: "3",
    gridRowStart: "1",
    justifySelf: "end",
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: "1px",
    borderRadius: radius.xl,
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    color: colors.cardForeground,
    display: "flex",
    flexDirection: "column",
    gap: "var(--card-spacing, 1.5rem)",
    paddingBottom: "var(--card-spacing, 1.5rem)",
    paddingTop: "var(--card-spacing, 1.5rem)",
  },
  emphasis: {
    borderRadius: "2rem",
    borderWidth: "2px",
    boxShadow: `6px 6px 0 0 color-mix(in oklab, ${colors.primary} 30%, transparent)`,
  },
  content: {
    paddingInline: "var(--card-spacing, 1.5rem)",
  },
  description: {
    color: colors.mutedForeground,
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
  },
  footer: {
    alignItems: "center",
    display: "flex",
    paddingInline: "var(--card-spacing, 1.5rem)",
  },
  header: {
    alignItems: "start",
    display: "grid",
    gap: "0.375rem",
    gridTemplateColumns: "1fr auto",
    gridTemplateRows: "auto auto",
    paddingInline: "var(--card-spacing, 1.5rem)",
  },
  title: {
    fontWeight: 600,
    letterSpacing: "-0.025em",
    lineHeight: 1,
  },
  sizeSm: {
    gap: "var(--card-spacing, 1rem)",
    paddingBottom: "var(--card-spacing, 1rem)",
    paddingTop: "var(--card-spacing, 1rem)",
  },
});

type DivProps = Omit<ComponentProps<"div">, "className" | "style">;

const makeSlot = (slot: string, style: StyleXStyles) => (props: DivProps) => (
  <div data-slot={slot} {...stylex.props(style)} {...props} />
);

export type CardProps = DivProps & {
  size?: "default" | "sm";
  emphasis?: boolean;
};

function Card(props: CardProps) {
  const size = props.size ?? "default";
  const emphasis = props.emphasis ?? false;
  const { size: _size, emphasis: _emphasis, ...rest } = props;

  return (
    <div
      {...stylex.props(
        styles.card,
        size === "sm" ? styles.sizeSm : null,
        emphasis ? styles.emphasis : null,
      )}
      data-size={size}
      data-slot="card"
      {...rest}
    />
  );
}

const CardHeader = makeSlot("card-header", styles.header);
const CardTitle = makeSlot("card-title", styles.title);
const CardDescription = makeSlot("card-description", styles.description);
const CardAction = makeSlot("card-action", styles.action);
const CardContent = makeSlot("card-content", styles.content);
const CardFooter = makeSlot("card-footer", styles.footer);

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
