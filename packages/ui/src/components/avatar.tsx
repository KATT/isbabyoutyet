import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { Children, cloneElement, isValidElement } from "react";

import { colors } from "@workspace/ui/lib/tokens.stylex";

const styles = stylex.create({
  badge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: "9999px",
    bottom: 0,
    boxShadow: `0 0 0 2px ${colors.background}`,
    color: colors.primaryForeground,
    display: "inline-flex",
    height: "0.625rem",
    insetInlineEnd: 0,
    justifyContent: "center",
    position: "absolute",
    userSelect: "none",
    width: "0.625rem",
    zIndex: 10,
  },
  fallback: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderRadius: "9999px",
    color: colors.mutedForeground,
    display: "flex",
    fontSize: "0.875rem",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  group: {
    display: "flex",
  },
  groupCount: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderRadius: "9999px",
    boxShadow: `0 0 0 2px ${colors.background}`,
    color: colors.mutedForeground,
    display: "flex",
    flexShrink: 0,
    fontSize: "0.875rem",
    height: "2rem",
    justifyContent: "center",
    marginInlineStart: "-0.5rem",
    position: "relative",
    width: "2rem",
  },
  image: {
    aspectRatio: "1 / 1",
    height: "100%",
    objectFit: "cover",
    width: "100%",
  },
  root: {
    borderRadius: "9999px",
    display: "flex",
    flexShrink: 0,
    height: "2rem",
    overflow: "hidden",
    position: "relative",
    userSelect: "none",
    width: "2rem",
  },
  rootLg: {
    height: "2.5rem",
    width: "2.5rem",
  },
  rootSm: {
    height: "1.5rem",
    width: "1.5rem",
  },
  stacked: {
    boxShadow: `0 0 0 2px ${colors.background}`,
    marginInlineStart: "-0.5rem",
  },
  stackedFirst: {
    boxShadow: `0 0 0 2px ${colors.background}`,
    marginInlineStart: 0,
  },
});

type AvatarSize = "default" | "sm" | "lg";

const sizeStyles: Record<AvatarSize, StyleXStyles> = {
  default: null as unknown as StyleXStyles,
  lg: styles.rootLg,
  sm: styles.rootSm,
};

export type AvatarProps = Omit<
  React.ComponentProps<typeof AvatarPrimitive.Root>,
  "className" | "style"
> & {
  size?: AvatarSize;
  /** Overlap offset when rendered inside `AvatarGroup`. */
  stackIndex?: number | null;
};

function Avatar(props: AvatarProps) {
  const size = props.size ?? "default";
  const stackIndex = props.stackIndex ?? null;
  const { size: _size, stackIndex: _stackIndex, ...rest } = props;
  const stylexProps = stylex.props(
    styles.root,
    sizeStyles[size],
    stackIndex === null ? null : stackIndex === 0 ? styles.stackedFirst : styles.stacked,
  );

  return (
    <AvatarPrimitive.Root
      className={stylexProps.className}
      style={stylexProps.style}
      data-size={size}
      data-slot="avatar"
      {...rest}
    />
  );
}

export type AvatarImageProps = Omit<
  React.ComponentProps<typeof AvatarPrimitive.Image>,
  "className" | "style"
>;

function AvatarImage(props: AvatarImageProps) {
  const stylexProps = stylex.props(styles.image);
  return (
    <AvatarPrimitive.Image
      className={stylexProps.className}
      style={stylexProps.style}
      data-slot="avatar-image"
      {...props}
    />
  );
}

export type AvatarFallbackProps = Omit<
  React.ComponentProps<typeof AvatarPrimitive.Fallback>,
  "className" | "style"
>;

function AvatarFallback(props: AvatarFallbackProps) {
  const stylexProps = stylex.props(styles.fallback);
  return (
    <AvatarPrimitive.Fallback
      className={stylexProps.className}
      style={stylexProps.style}
      data-slot="avatar-fallback"
      {...props}
    />
  );
}

export type AvatarBadgeProps = Omit<React.ComponentProps<"span">, "className" | "style">;

function AvatarBadge(props: AvatarBadgeProps) {
  const stylexProps = stylex.props(styles.badge);
  return (
    <span
      className={stylexProps.className}
      style={stylexProps.style}
      data-slot="avatar-badge"
      {...props}
    />
  );
}

export type AvatarGroupProps = Omit<React.ComponentProps<"div">, "className" | "style">;

function AvatarGroup(props: AvatarGroupProps) {
  const { children, ...rest } = props;
  const stylexProps = stylex.props(styles.group);
  return (
    <div
      className={stylexProps.className}
      style={stylexProps.style}
      data-slot="avatar-group"
      {...rest}
    >
      {Children.map(children, (child, index) =>
        isValidElement<{ stackIndex?: number | null }>(child)
          ? cloneElement(child, { stackIndex: index })
          : child,
      )}
    </div>
  );
}

export type AvatarGroupCountProps = Omit<React.ComponentProps<"div">, "className" | "style">;

function AvatarGroupCount(props: AvatarGroupCountProps) {
  const stylexProps = stylex.props(styles.groupCount);
  return (
    <div
      className={stylexProps.className}
      style={stylexProps.style}
      data-slot="avatar-group-count"
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage, AvatarBadge, AvatarGroup, AvatarGroupCount };
