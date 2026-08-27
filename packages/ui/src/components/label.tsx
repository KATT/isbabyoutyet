import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";

import { colors } from "@workspace/ui/lib/tokens.stylex";
import { customClassName } from "@workspace/ui/lib/utils.stylex";

const styles = stylex.create({
  root: {
    alignItems: "center",
    color: colors.foreground,
    display: "inline-flex",
    fontSize: "0.875rem",
    fontWeight: 500,
    gap: "0.5rem",
    lineHeight: 1,
    userSelect: "none",
  },
});

const Label = ({
  className,
  style,
  ...props
}: React.ComponentProps<"label"> & { className?: string }) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor/children supplied by consumer
  <label
    {...stylex.props(styles.root, customClassName(className), style as StyleXStyles)}
    data-slot="label"
    {...props}
  />
);

export { Label };
