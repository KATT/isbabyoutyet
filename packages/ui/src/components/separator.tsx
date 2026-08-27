import { Separator as SeparatorPrimitive } from "@base-ui/react";
import * as stylex from "@stylexjs/stylex";

import { colors } from "@workspace/ui/lib/tokens.stylex";

const styles = stylex.create({
  horizontal: {
    height: "1px",
    width: "100%",
  },
  root: {
    backgroundColor: colors.border,
    flexShrink: 0,
  },
  vertical: {
    height: "100%",
    width: "1px",
  },
});

const Separator = ({
  orientation = "horizontal",
  ...props
}: Omit<React.ComponentProps<typeof SeparatorPrimitive>, "className">) => (
  <SeparatorPrimitive
    data-slot="separator"
    orientation={orientation}
    {...stylex.props(styles.root, orientation === "vertical" ? styles.vertical : styles.horizontal)}
    {...props}
  />
);

export { Separator };
