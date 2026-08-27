import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import * as stylex from "@stylexjs/stylex";

import { colors } from "@workspace/ui/lib/tokens.stylex";

const styles = stylex.create({
  group: {
    display: "flex",
    flexDirection: "column",
    gap: "0.625rem",
  },
  indicator: {
    backgroundColor: colors.primary,
    borderRadius: "9999px",
    height: "0.5rem",
    width: "0.5rem",
  },
  item: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: colors.input,
    borderRadius: "9999px",
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: {
      ":focus-visible": `0 0 0 3px color-mix(in oklab, ${colors.ring} 50%, transparent)`,
      default: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    },
    cursor: { ":disabled": "not-allowed", default: "pointer" },
    display: "inline-flex",
    flexShrink: 0,
    height: "1rem",
    justifyContent: "center",
    opacity: { ":disabled": 0.5, default: 1 },
    outline: "none",
    padding: 0,
    width: "1rem",
  },
  itemChecked: {
    borderColor: colors.primary,
  },
});

const RadioGroup = ({
  ...props
}: Omit<React.ComponentProps<typeof RadioGroupPrimitive>, "className">) => (
  <RadioGroupPrimitive {...stylex.props(styles.group)} data-slot="radio-group" {...props} />
);

const RadioGroupItem = ({
  ...props
}: Omit<React.ComponentProps<typeof RadioPrimitive.Root>, "className">) => (
  <RadioPrimitive.Root
    className={(state) => stylex.props(styles.item, state.checked && styles.itemChecked).className}
    data-slot="radio-group-item"
    {...props}
  >
    <RadioPrimitive.Indicator
      className={stylex.props(styles.indicator).className}
      data-slot="radio-group-indicator"
    />
  </RadioPrimitive.Root>
);

export { RadioGroup, RadioGroupItem };
