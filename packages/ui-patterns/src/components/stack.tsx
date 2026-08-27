import type { ComponentProps } from "react";
import * as stylex from "@stylexjs/stylex";

import { spacing } from "@workspace/ui/lib/tokens.stylex";

const gapStyles = stylex.create({
  none: { gap: spacing.none },
  s1: { gap: spacing.s1 },
  s1_5: { gap: spacing.s1_5 },
  s2: { gap: spacing.s2 },
  s3: { gap: spacing.s3 },
  s4: { gap: spacing.s4 },
  s5: { gap: spacing.s5 },
  s6: { gap: spacing.s6 },
  s8: { gap: spacing.s8 },
  s10: { gap: spacing.s10 },
  s12: { gap: spacing.s12 },
});

const alignStyles = stylex.create({
  start: { alignItems: "flex-start" },
  center: { alignItems: "center" },
  end: { alignItems: "flex-end" },
  stretch: { alignItems: "stretch" },
  baseline: { alignItems: "baseline" },
});

const justifyStyles = stylex.create({
  start: { justifyContent: "flex-start" },
  center: { justifyContent: "center" },
  end: { justifyContent: "flex-end" },
  between: { justifyContent: "space-between" },
});

const stackStyles = stylex.create({
  base: {
    display: "flex",
    minWidth: 0,
  },
  column: {
    flexDirection: "column",
  },
  row: {
    flexDirection: "row",
  },
  wrap: {
    flexWrap: "wrap",
  },
  grow: {
    flexGrow: 1,
  },
  fullWidth: {
    width: "100%",
  },
});

export type StackGap = keyof typeof gapStyles;
export type StackAlign = keyof typeof alignStyles;
export type StackJustify = keyof typeof justifyStyles;

export type StackProps = Omit<ComponentProps<"div">, "className" | "style"> & {
  direction?: "column" | "row";
  gap?: StackGap;
  align?: StackAlign | null;
  justify?: StackJustify | null;
  wrap?: boolean;
  grow?: boolean;
  fullWidth?: boolean;
};

function Stack(props: StackProps) {
  const direction = props.direction ?? "column";
  const gap = props.gap ?? "s4";
  const align = props.align === undefined ? (direction === "row" ? "center" : null) : props.align;
  const justify = props.justify ?? null;
  const wrap = props.wrap ?? false;
  const grow = props.grow ?? false;
  const fullWidth = props.fullWidth ?? false;

  return (
    <div
      {...stylex.props(
        stackStyles.base,
        direction === "row" ? stackStyles.row : stackStyles.column,
        gapStyles[gap],
        align === null ? null : alignStyles[align],
        justify === null ? null : justifyStyles[justify],
        wrap ? stackStyles.wrap : null,
        grow ? stackStyles.grow : null,
        fullWidth ? stackStyles.fullWidth : null,
      )}
      data-slot="stack"
      {...omitStackLayoutProps(props)}
    />
  );
}

function omitStackLayoutProps(props: StackProps) {
  const {
    direction: _direction,
    gap: _gap,
    align: _align,
    justify: _justify,
    wrap: _wrap,
    grow: _grow,
    fullWidth: _fullWidth,
    ...rest
  } = props;
  return rest;
}

export { Stack, gapStyles, stackStyles, alignStyles, justifyStyles };
