import type { ComponentProps } from "react";
import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";

import { spacing } from "@workspace/ui/lib/tokens.stylex";
import { customClassName } from "@workspace/ui/lib/utils.stylex";

const gapStyles = stylex.create({
  none: { gap: spacing.none },
  s1: { gap: spacing.s1 },
  s1_5: { gap: spacing.s1_5 },
  s2: { gap: spacing.s2 },
  s3: { gap: spacing.s3 },
  s4: { gap: spacing.s4 },
  s6: { gap: spacing.s6 },
  s8: { gap: spacing.s8 },
});

const stackStyles = stylex.create({
  base: {
    display: "flex",
  },
  column: {
    flexDirection: "column",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
});

export type StackGap = keyof typeof gapStyles;

export type StackProps = Omit<ComponentProps<"div">, "className" | "style"> & {
  direction?: "column" | "row";
  gap?: StackGap;
  className?: string;
  style?: StyleXStyles;
};

function Stack(props: StackProps) {
  const direction = props.direction ?? "column";
  const gap = props.gap ?? "s4";
  const { className: _className, style: _style, direction: _direction, gap: _gap, ...rest } = props;

  return (
    <div
      {...stylex.props(
        stackStyles.base,
        direction === "row" ? stackStyles.row : stackStyles.column,
        gapStyles[gap],
        customClassName(props.className),
        props.style,
      )}
      data-slot="stack"
      {...rest}
    />
  );
}

export { Stack, gapStyles, stackStyles };
