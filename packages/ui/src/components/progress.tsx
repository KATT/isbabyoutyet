import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import * as stylex from "@stylexjs/stylex";

import { colors } from "@workspace/ui/lib/tokens.stylex";

const progressSweep = stylex.keyframes({
  from: { transform: "translateX(-100%)" },
  to: { transform: "translateX(400%)" },
});

const styles = stylex.create({
  indicator: {
    backgroundColor: colors.primary,
    height: "100%",
    transition: "all 0.2s ease-in-out",
    width: "100%",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 500,
  },
  navigation: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 20%, transparent)`,
    height: "0.5rem",
    insetInline: 0,
    overflow: "hidden",
    pointerEvents: "none",
    position: "fixed",
    top: 0,
    width: "100%",
    zIndex: 50,
  },
  navigationIndicator: {
    animationDuration: "1s",
    animationIterationCount: "infinite",
    animationName: progressSweep,
    animationTimingFunction: "ease-in-out",
    backgroundColor: colors.primary,
    borderRadius: "9999px",
    height: "100%",
    width: "25%",
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
      width: "100%",
    },
  },
  root: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 20%, transparent)`,
    borderRadius: "9999px",
    height: "0.5rem",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  rootWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    width: "100%",
  },
  track: {
    height: "100%",
    width: "100%",
  },
  value: {
    color: colors.mutedForeground,
    fontSize: "0.875rem",
  },
});

type ProgressPlacement = "default" | "navigation";

export type ProgressProps = Omit<
  React.ComponentProps<typeof ProgressPrimitive.Root>,
  "className" | "style"
> & {
  placement?: ProgressPlacement;
};

function Progress(props: ProgressProps) {
  const placement = props.placement ?? "default";
  const isNavigation = placement === "navigation";
  const {
    placement: _placement,
    children,
    ...rest
  } = props;

  const rootStylex = stylex.props(isNavigation ? styles.navigation : styles.rootWrapper);
  const trackStylex = stylex.props(styles.root);
  const indicatorStylex = stylex.props(
    styles.indicator,
    isNavigation ? styles.navigationIndicator : null,
  );

  return (
    <ProgressPrimitive.Root
      className={rootStylex.className}
      style={rootStylex.style}
      data-slot={isNavigation ? "navigation-progress" : "progress"}
      {...rest}
    >
      {children}
      <ProgressPrimitive.Track
        className={trackStylex.className}
        style={trackStylex.style}
        data-slot="progress-track"
      >
        <ProgressPrimitive.Indicator
          className={indicatorStylex.className}
          style={indicatorStylex.style}
          data-slot={isNavigation ? "navigation-progress-indicator" : "progress-indicator"}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export type ProgressLabelProps = Omit<
  React.ComponentProps<typeof ProgressPrimitive.Label>,
  "className" | "style"
>;

function ProgressLabel(props: ProgressLabelProps) {
  const stylexProps = stylex.props(styles.label);
  return (
    <ProgressPrimitive.Label
      className={stylexProps.className}
      style={stylexProps.style}
      data-slot="progress-label"
      {...props}
    />
  );
}

export type ProgressValueProps = Omit<
  React.ComponentProps<typeof ProgressPrimitive.Value>,
  "className" | "style"
>;

function ProgressValue(props: ProgressValueProps) {
  const stylexProps = stylex.props(styles.value);
  return (
    <ProgressPrimitive.Value
      className={stylexProps.className}
      style={stylexProps.style}
      data-slot="progress-value"
      {...props}
    />
  );
}

export { Progress, ProgressLabel, ProgressValue };
