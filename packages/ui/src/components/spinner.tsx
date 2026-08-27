import * as stylex from "@stylexjs/stylex";
import { Loader2Icon } from "lucide-react";


const spin = stylex.keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

const styles = stylex.create({
  root: {
    animationDuration: "1s",
    animationIterationCount: "infinite",
    animationName: spin,
    animationTimingFunction: "linear",
    flexShrink: 0,
    height: "1rem",
    width: "1rem",
  },
});

const Spinner = ({ ...props
}: Omit<React.ComponentProps<typeof Loader2Icon>, "className" | "style">) => (
  <Loader2Icon
    aria-label="Loading"
    {...stylex.props(styles.root)}
    data-slot="spinner"
    role="status"
    {...props}
  />
);

export { Spinner };
