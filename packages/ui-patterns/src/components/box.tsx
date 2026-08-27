import type { ComponentProps } from "react";
import * as stylex from "@stylexjs/stylex";

import { spacing } from "@workspace/ui/lib/tokens.stylex";

const padStyles = stylex.create({
  none: { padding: spacing.none },
  s1: { padding: spacing.s1 },
  s1_5: { padding: spacing.s1_5 },
  s2: { padding: spacing.s2 },
  s3: { padding: spacing.s3 },
  s4: { padding: spacing.s4 },
  s5: { padding: spacing.s5 },
  s6: { padding: spacing.s6 },
  s8: { padding: spacing.s8 },
  s10: { padding: spacing.s10 },
  s12: { padding: spacing.s12 },
});

const padXStyles = stylex.create({
  none: { paddingInline: spacing.none },
  s1: { paddingInline: spacing.s1 },
  s2: { paddingInline: spacing.s2 },
  s3: { paddingInline: spacing.s3 },
  s4: { paddingInline: spacing.s4 },
  s5: { paddingInline: spacing.s5 },
  s6: { paddingInline: spacing.s6 },
  s8: { paddingInline: spacing.s8 },
});

const padYStyles = stylex.create({
  none: { paddingBlock: spacing.none },
  s1: { paddingBlock: spacing.s1 },
  s2: { paddingBlock: spacing.s2 },
  s3: { paddingBlock: spacing.s3 },
  s4: { paddingBlock: spacing.s4 },
  s5: { paddingBlock: spacing.s5 },
  s6: { paddingBlock: spacing.s6 },
  s8: { paddingBlock: spacing.s8 },
});

const boxStyles = stylex.create({
  base: {
    boxSizing: "border-box",
    minWidth: 0,
  },
  fullWidth: {
    width: "100%",
  },
  grow: {
    flexGrow: 1,
  },
});

export type BoxPad = keyof typeof padStyles;
export type BoxPadAxis = keyof typeof padXStyles;

export type BoxProps = Omit<ComponentProps<"div">, "className" | "style"> & {
  pad?: BoxPad;
  padX?: BoxPadAxis | null;
  padY?: BoxPadAxis | null;
  fullWidth?: boolean;
  grow?: boolean;
};

function Box(props: BoxProps) {
  const pad = props.pad ?? "none";
  const padX = props.padX ?? null;
  const padY = props.padY ?? null;
  const fullWidth = props.fullWidth ?? false;
  const grow = props.grow ?? false;

  return (
    <div
      {...stylex.props(
        boxStyles.base,
        padStyles[pad],
        padX === null ? null : padXStyles[padX],
        padY === null ? null : padYStyles[padY],
        fullWidth ? boxStyles.fullWidth : null,
        grow ? boxStyles.grow : null,
      )}
      data-slot="box"
      {...omitBoxLayoutProps(props)}
    />
  );
}

function omitBoxLayoutProps(props: BoxProps) {
  const {
    pad: _pad,
    padX: _padX,
    padY: _padY,
    fullWidth: _fullWidth,
    grow: _grow,
    ...rest
  } = props;
  return rest;
}

export { Box, padStyles, boxStyles };
