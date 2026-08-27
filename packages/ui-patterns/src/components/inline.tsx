import type { ComponentProps } from "react";
import * as stylex from "@stylexjs/stylex";

import {
  alignStyles,
  gapStyles,
  justifyStyles,
  type StackAlign,
  type StackGap,
  type StackJustify,
} from "@workspace/ui-patterns/components/stack";

const inlineStyles = stylex.create({
  base: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    minWidth: 0,
  },
  nowrap: {
    flexWrap: "nowrap",
  },
  fullWidth: {
    width: "100%",
  },
});

export type InlineProps = Omit<ComponentProps<"div">, "className" | "style"> & {
  gap?: StackGap;
  align?: StackAlign;
  justify?: StackJustify | null;
  wrap?: boolean;
  fullWidth?: boolean;
};

function Inline(props: InlineProps) {
  const gap = props.gap ?? "s2";
  const align = props.align ?? "center";
  const justify = props.justify ?? null;
  const wrap = props.wrap ?? true;
  const fullWidth = props.fullWidth ?? false;

  return (
    <div
      {...stylex.props(
        inlineStyles.base,
        wrap ? null : inlineStyles.nowrap,
        gapStyles[gap],
        alignStyles[align],
        justify === null ? null : justifyStyles[justify],
        fullWidth ? inlineStyles.fullWidth : null,
      )}
      data-slot="inline"
      {...omitInlineLayoutProps(props)}
    />
  );
}

function omitInlineLayoutProps(props: InlineProps) {
  const {
    gap: _gap,
    align: _align,
    justify: _justify,
    wrap: _wrap,
    fullWidth: _fullWidth,
    ...rest
  } = props;
  return rest;
}

export { Inline, inlineStyles };
