import type { ComponentProps } from "react";
import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";

import { customClassName } from "@workspace/ui/lib/utils.stylex";
import { gapStyles, type StackGap } from "@workspace/ui-patterns/components/stack";

const inlineStyles = stylex.create({
  base: {
    alignItems: "center",
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
  },
});

export type InlineProps = Omit<ComponentProps<"div">, "className" | "style"> & {
  gap?: StackGap;
  className?: string;
  style?: StyleXStyles;
};

function Inline(props: InlineProps) {
  const gap = props.gap ?? "s2";
  const { className: _className, style: _style, gap: _gap, ...rest } = props;

  return (
    <div
      {...stylex.props(
        inlineStyles.base,
        gapStyles[gap],
        customClassName(props.className),
        props.style,
      )}
      data-slot="inline"
      {...rest}
    />
  );
}

export { Inline, inlineStyles };
