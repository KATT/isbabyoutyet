import type { ComponentProps } from "react";
import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";

import { spacing } from "@workspace/ui-cssinjs/lib/tokens.stylex";
import { customClassName } from "@workspace/ui-cssinjs/lib/utils.stylex";

const padStyles = stylex.create({
  none: { padding: spacing.none },
  s2: { padding: spacing.s2 },
  s3: { padding: spacing.s3 },
  s4: { padding: spacing.s4 },
  s6: { padding: spacing.s6 },
  s8: { padding: spacing.s8 },
});

const boxStyles = stylex.create({
  base: {
    boxSizing: "border-box",
  },
});

export type BoxPad = keyof typeof padStyles;

export type BoxProps = Omit<ComponentProps<"div">, "className" | "style"> & {
  pad?: BoxPad;
  className?: string;
  style?: StyleXStyles;
};

function Box(props: BoxProps) {
  const pad = props.pad ?? "none";
  const { className: _className, style: _style, pad: _pad, ...rest } = props;

  return (
    <div
      {...stylex.props(
        boxStyles.base,
        padStyles[pad],
        customClassName(props.className),
        props.style,
      )}
      data-slot="box"
      {...rest}
    />
  );
}

export { Box, padStyles, boxStyles };
