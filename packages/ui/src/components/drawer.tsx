"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";

import { colors, radius } from "@workspace/ui/lib/tokens.stylex";

type SwipeDirection = NonNullable<DrawerPrimitive.Root.Props["swipeDirection"]>;

type DrawerContextProps = {
  hasSnapPoints: boolean;
  modal: DrawerPrimitive.Root.Props["modal"];
  showSwipeHandle: boolean;
  swipeDirection: SwipeDirection;
};

const DrawerContext = React.createContext<DrawerContextProps | null>(null);

function useDrawer() {
  const context = React.useContext(DrawerContext);

  if (!context) {
    throw new Error("useDrawer must be used within a Drawer.");
  }

  return context;
}

const styles = stylex.create({
  content: {
    borderRadius: "inherit",
    display: "flex",
    flex: 1,
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
    overscrollBehavior: "contain",
    transition: "opacity 300ms cubic-bezier(0.45, 1.005, 0, 1.005)",
    userSelect: {
      default: "text",
      ":is([data-swiping])": "none",
    },
  },
  description: {
    color: colors.mutedForeground,
    fontSize: "0.875rem",
    textWrap: "balance",
  },
  footer: {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    gap: "0.5rem",
    marginTop: "auto",
    paddingBottom: "1rem",
    paddingInline: "1rem",
    paddingTop: 0,
  },
  handle: {
    cursor: {
      default: "grab",
      ":active": "grabbing",
    },
    display: "flex",
    flexShrink: 0,
    position: "relative",
    transition: "opacity 200ms ease",
    zIndex: 10,
    "::after": {
      backgroundColor: colors.muted,
      borderRadius: "9999px",
      content: '""',
      display: "block",
      flexShrink: 0,
    },
  },
  handleAxisX: {
    alignItems: "center",
    height: "100%",
    width: "0.75rem",
    "::after": {
      height: "6rem",
      width: "0.25rem",
    },
  },
  handleAxisY: {
    height: "0.75rem",
    justifyContent: "center",
    width: "100%",
    "::after": {
      height: "0.25rem",
      width: "6rem",
    },
  },
  handleDirDown: {
    alignItems: "flex-end",
  },
  handleDirLeft: {
    justifyContent: "flex-start",
    order: 9999,
  },
  handleDirRight: {
    justifyContent: "flex-end",
  },
  handleDirUp: {
    alignItems: "flex-start",
    order: 9999,
  },
  header: {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    gap: "0.125rem",
    paddingBottom: 0,
    paddingInline: "1rem",
    paddingTop: "1rem",
    textAlign: {
      "@media (min-width: 768px)": "start",
      default: "center",
    },
  },
  headerAxisY: {
    textAlign: {
      "@media (min-width: 768px)": "start",
      default: "center",
    },
  },
  overlay: {
    backgroundColor: "rgb(0 0 0 / 0.1)",
    inset: 0,
    minHeight: "100dvh",
    opacity: "max(var(--drawer-overlay-min-opacity, 0), calc(1 - var(--drawer-swipe-progress)))",
    position: {
      default: "fixed",
      "@supports (-webkit-touch-callout: none)": "absolute",
    },
    transitionDuration: {
      default: "450ms",
      ":is([data-ending-style])": "calc(var(--drawer-swipe-strength) * 400ms)",
      ":is([data-swiping])": "0ms",
    },
    transitionProperty: "opacity",
    transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
    userSelect: "none",
    zIndex: 50,
    "@supports (backdrop-filter: blur(0))": {
      backdropFilter: "blur(4px)",
    },
  },
  overlayHidden: {
    opacity: 0,
    pointerEvents: "none",
  },
  overlaySnapPoints: {
    // sets CSS var used by overlay opacity formula
    "--drawer-overlay-min-opacity": "0.5",
  },
  popup: {
    backgroundColor: colors.popover,
    color: colors.popoverForeground,
    display: "flex",
    filter: {
      default: null,
      ":is([data-nested-drawer-open])": "brightness(0.95)",
    },
    flexDirection: "column",
    fontSize: "0.875rem",
    height: "var(--drawer-content-height)",
    margin: "var(--drawer-inset, 0px)",
    maxHeight: "var(--drawer-content-max-height, none)",
    minHeight: 0,
    outline: "none",
    overflow: {
      default: null,
      ":is([data-nested-drawer-open])": "hidden",
    },
    pointerEvents: "auto",
    position: "fixed",
    transform:
      "translate3d(var(--translate-x, 0px), var(--translate-y, 0px), 0) scale(var(--stack-scale))",
    transitionDuration: {
      default: "450ms",
      ":is([data-ending-style])": "calc(var(--drawer-swipe-strength) * 400ms)",
      ":is([data-nested-drawer-swiping])": "0ms",
      ":is([data-swiping])": "0ms",
    },
    transitionProperty: "transform, height, opacity, filter",
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    userSelect: "none",
    width: "var(--drawer-content-width, auto)",
    willChange: "transform",
    zIndex: 50,
    // stack / sizing CSS variables
    "--bleed": "3rem",
    "--drawer-content-height": "var(--drawer-height, auto)",
    "--peek": "1rem",
    "--stack-height": "var(--drawer-frontmost-height, var(--drawer-height, 0px))",
    "--stack-peek-offset":
      "max(0px, calc((var(--nested-drawers) - var(--stack-progress)) * var(--peek)))",
    "--stack-progress": "clamp(0, var(--drawer-swipe-progress), 1)",
    "--stack-scale":
      "clamp(0, calc(var(--stack-scale-base) + (var(--stack-step) * var(--stack-progress))), 1)",
    "--stack-scale-base": "max(0, calc(1 - (var(--nested-drawers) * var(--stack-step))))",
    "--stack-shrink": "calc(1 - var(--stack-scale))",
    "--stack-step": "0.05",
    "::after": {
      backgroundColor: "var(--drawer-bleed-background, var(--color-popover, var(--popover)))",
      content: '""',
      pointerEvents: "none",
      position: "absolute",
    },
  },
  popupAxisX: {
    flexDirection: "row",
    insetBlock: 0,
    "--drawer-content-width": "75%",
    "@media (min-width: 640px)": {
      "--drawer-content-width": "24rem",
    },
    "::after": {
      insetBlock: 0,
      width: "var(--bleed)",
    },
  },
  popupAxisY: {
    insetInline: 0,
    "--drawer-content-max-height": "calc(100dvh - 6rem)",
    height: {
      default: "var(--drawer-content-height)",
      ":is([data-nested-drawer-open])": "var(--stack-height)",
    },
    "::after": {
      height: "var(--bleed)",
      insetInline: 0,
    },
  },
  popupAxisYSnap: {
    "--drawer-content-height": "100dvh",
  },
  popupClosed: {
    opacity: 0.9999,
    transform: "var(--closed-transform)",
  },
  popupDirDown: {
    borderTopColor: colors.border,
    borderTopStyle: "solid",
    borderTopWidth: "1px",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    bottom: 0,
    transformOrigin: "bottom",
    "--closed-transform": "translate3d(0, calc(100% + var(--drawer-inset, 0px) + 2px), 0)",
    "--translate-y":
      "calc(var(--drawer-snap-point-offset, 0px) + var(--drawer-swipe-movement-y) - var(--stack-peek-offset) - (var(--stack-shrink) * var(--stack-height)))",
    "::after": {
      top: "100%",
    },
  },
  popupDirLeft: {
    borderRightColor: colors.border,
    borderRightStyle: "solid",
    borderRightWidth: "1px",
    borderTopRightRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    left: 0,
    transformOrigin: "left",
    "--closed-transform": "translate3d(calc(-100% - var(--drawer-inset, 0px) - 2px), 0, 0)",
    "--translate-x":
      "calc(var(--drawer-swipe-movement-x) + var(--stack-peek-offset) + (var(--stack-shrink) * 100%))",
    "::after": {
      right: "100%",
    },
  },
  popupDirRight: {
    borderLeftColor: colors.border,
    borderLeftStyle: "solid",
    borderLeftWidth: "1px",
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    right: 0,
    transformOrigin: "right",
    "--closed-transform": "translate3d(calc(100% + var(--drawer-inset, 0px) + 2px), 0, 0)",
    "--translate-x":
      "calc(var(--drawer-swipe-movement-x) - var(--stack-peek-offset) - (var(--stack-shrink) * 100%))",
    "::after": {
      left: "100%",
    },
  },
  popupDirUp: {
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    top: 0,
    transformOrigin: "top",
    "--closed-transform": "translate3d(0, calc(-100% - var(--drawer-inset, 0px) - 2px), 0)",
    "--translate-y":
      "calc(var(--drawer-snap-point-offset, 0px) + var(--drawer-swipe-movement-y) + var(--stack-peek-offset) + (var(--stack-shrink) * var(--stack-height)))",
    "::after": {
      bottom: "100%",
    },
  },
  title: {
    color: colors.foreground,
    fontSize: "1rem",
    fontWeight: 500,
  },
  viewport: {
    inset: 0,
    pointerEvents: "none",
    position: "fixed",
    userSelect: "none",
    zIndex: 50,
  },
  viewportModal: {
    pointerEvents: "auto",
  },
});

const directionStyles: Record<SwipeDirection, StyleXStyles> = {
  down: styles.popupDirDown,
  left: styles.popupDirLeft,
  right: styles.popupDirRight,
  up: styles.popupDirUp,
};

const handleDirectionStyles: Record<SwipeDirection, StyleXStyles> = {
  down: styles.handleDirDown,
  left: styles.handleDirLeft,
  right: styles.handleDirRight,
  up: styles.handleDirUp,
};

function Drawer({
  modal = true,
  showSwipeHandle = false,
  snapPoints,
  swipeDirection = "down",
  ...props
}: Omit<DrawerPrimitive.Root.Props, "className" | "style"> & {
  showSwipeHandle?: boolean;
}) {
  const hasSnapPoints = snapPoints != null && snapPoints.length > 0;
  const contextValue = React.useMemo(
    () => ({ hasSnapPoints, modal, showSwipeHandle, swipeDirection }),
    [hasSnapPoints, modal, showSwipeHandle, swipeDirection],
  );

  return (
    <DrawerContext.Provider value={contextValue}>
      <DrawerPrimitive.Root
        data-slot="drawer"
        modal={modal}
        snapPoints={snapPoints}
        swipeDirection={swipeDirection}
        {...props}
      />
    </DrawerContext.Provider>
  );
}

function DrawerTrigger(props: Omit<DrawerPrimitive.Trigger.Props, "className" | "style">) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal(props: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose(props: Omit<DrawerPrimitive.Close.Props, "className" | "style">) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay(
  props: Omit<DrawerPrimitive.Backdrop.Props, "className" | "style"> & {
    "data-snap-points"?: string | undefined;
  },
) {
  const snapPoints = props["data-snap-points"] !== undefined;
  const { ["data-snap-points"]: _snap, ...rest } = props;
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      data-snap-points={props["data-snap-points"]}
      className={(state) =>
        stylex.props(
          styles.overlay,
          snapPoints ? styles.overlaySnapPoints : null,
          (state.transitionStatus === "starting" || state.transitionStatus === "ending") &&
            styles.overlayHidden,
        ).className
      }
      {...rest}
    />
  );
}

function DrawerSwipeHandle(props: Omit<React.ComponentProps<"div">, "className" | "style">) {
  const { swipeDirection } = useDrawer();
  const swipeAxis = swipeDirection === "down" || swipeDirection === "up" ? "y" : "x";
  const stylexProps = stylex.props(
    styles.handle,
    swipeAxis === "x" ? styles.handleAxisX : styles.handleAxisY,
    handleDirectionStyles[swipeDirection],
  );
  return (
    <div
      data-slot="drawer-swipe-handle"
      aria-hidden="true"
      className={stylexProps.className}
      style={stylexProps.style}
      {...props}
    />
  );
}

function DrawerContent({
  children,
  ...props
}: Omit<DrawerPrimitive.Popup.Props, "className" | "style">) {
  const { hasSnapPoints, modal, showSwipeHandle, swipeDirection } = useDrawer();
  const swipeAxis = swipeDirection === "down" || swipeDirection === "up" ? "y" : "x";
  const contentStylex = stylex.props(styles.content);

  return (
    <DrawerPortal data-slot="drawer-portal">
      {modal === true && <DrawerOverlay data-snap-points={hasSnapPoints ? "" : undefined} />}
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        data-modal={modal}
        {...stylex.props(styles.viewport, modal === true ? styles.viewportModal : null)}
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-popup"
          data-swipe-axis={swipeAxis}
          data-swipe-direction={swipeDirection}
          data-snap-points={hasSnapPoints ? "" : undefined}
          className={(state) =>
            stylex.props(
              styles.popup,
              swipeAxis === "x" ? styles.popupAxisX : styles.popupAxisY,
              swipeAxis === "y" && hasSnapPoints ? styles.popupAxisYSnap : null,
              directionStyles[swipeDirection],
              (state.transitionStatus === "starting" || state.transitionStatus === "ending") &&
                styles.popupClosed,
            ).className
          }
          {...props}
        >
          {showSwipeHandle && <DrawerSwipeHandle />}
          <DrawerPrimitive.Content
            data-slot="drawer-content"
            className={contentStylex.className}
            style={contentStylex.style}
          >
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

function DrawerHeader(props: Omit<React.ComponentProps<"div">, "className" | "style">) {
  const { swipeDirection } = useDrawer();
  const swipeAxis = swipeDirection === "down" || swipeDirection === "up" ? "y" : "x";
  const stylexProps = stylex.props(styles.header, swipeAxis === "y" ? styles.headerAxisY : null);
  return (
    <div
      data-slot="drawer-header"
      className={stylexProps.className}
      style={stylexProps.style}
      {...props}
    />
  );
}

function DrawerFooter(props: Omit<React.ComponentProps<"div">, "className" | "style">) {
  const stylexProps = stylex.props(styles.footer);
  return (
    <div
      data-slot="drawer-footer"
      className={stylexProps.className}
      style={stylexProps.style}
      {...props}
    />
  );
}

function DrawerTitle(props: Omit<DrawerPrimitive.Title.Props, "className" | "style">) {
  const stylexProps = stylex.props(styles.title);
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={stylexProps.className}
      style={stylexProps.style}
      {...props}
    />
  );
}

function DrawerDescription(props: Omit<DrawerPrimitive.Description.Props, "className" | "style">) {
  const stylexProps = stylex.props(styles.description);
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={stylexProps.className}
      style={stylexProps.style}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerSwipeHandle,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
