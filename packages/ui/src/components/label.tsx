import * as stylex from "@stylexjs/stylex";

import { colors } from "@workspace/ui/lib/tokens.stylex";

const styles = stylex.create({
  root: {
    alignItems: "center",
    color: {
      default: colors.foreground,
      ":is([data-error=true])": colors.destructive,
    },
    display: "inline-flex",
    fontSize: "0.875rem",
    fontWeight: 500,
    gap: "0.5rem",
    lineHeight: 1,
    userSelect: "none",
  },
});

export type LabelProps = Omit<React.ComponentProps<"label">, "className" | "style">;

function Label(props: LabelProps) {
  const stylexProps = stylex.props(styles.root);
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor/children supplied by consumer
    <label
      className={stylexProps.className}
      style={stylexProps.style}
      data-slot="label"
      {...props}
    />
  );
}

export { Label };
