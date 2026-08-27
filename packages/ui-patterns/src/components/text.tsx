import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";

import { colors } from "@workspace/ui/lib/tokens.stylex";

const textStyles = stylex.create({
  base: {
    margin: 0,
  },
  toneForeground: { color: colors.foreground },
  toneMuted: { color: colors.mutedForeground },
  tonePrimary: { color: colors.primary },
  toneDestructive: { color: colors.destructive },
  toneCard: { color: colors.cardForeground },
  sizeXs: { fontSize: "0.75rem", lineHeight: "1rem" },
  sizeSm: { fontSize: "0.875rem", lineHeight: "1.25rem" },
  sizeMd: { fontSize: "1rem", lineHeight: "1.5rem" },
  sizeLg: { fontSize: "1.125rem", lineHeight: "1.75rem" },
  sizeXl: { fontSize: "1.25rem", lineHeight: "1.75rem" },
  size2xl: { fontSize: "1.5rem", lineHeight: "2rem" },
  size3xl: { fontSize: "1.875rem", lineHeight: "2.25rem" },
  size4xl: { fontSize: "2.25rem", lineHeight: "2.5rem" },
  weightNormal: { fontWeight: 400 },
  weightMedium: { fontWeight: 500 },
  weightSemibold: { fontWeight: 600 },
  weightBold: { fontWeight: 700 },
  weightExtrabold: { fontWeight: 800 },
  weightBlack: { fontWeight: 900 },
  alignStart: { textAlign: "start" },
  alignCenter: { textAlign: "center" },
  alignEnd: { textAlign: "end" },
  truncate: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

type TextTone = "foreground" | "muted" | "primary" | "destructive" | "card";
type TextSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
type TextWeight = "normal" | "medium" | "semibold" | "bold" | "extrabold" | "black";
type TextAlign = "start" | "center" | "end";
type TextAs = "p" | "span" | "div" | "h1" | "h2" | "h3" | "h4";

const toneStyles: Record<TextTone, StyleXStyles> = {
  foreground: textStyles.toneForeground,
  muted: textStyles.toneMuted,
  primary: textStyles.tonePrimary,
  destructive: textStyles.toneDestructive,
  card: textStyles.toneCard,
};

const sizeStyles: Record<TextSize, StyleXStyles> = {
  xs: textStyles.sizeXs,
  sm: textStyles.sizeSm,
  md: textStyles.sizeMd,
  lg: textStyles.sizeLg,
  xl: textStyles.sizeXl,
  "2xl": textStyles.size2xl,
  "3xl": textStyles.size3xl,
  "4xl": textStyles.size4xl,
};

const weightStyles: Record<TextWeight, StyleXStyles> = {
  normal: textStyles.weightNormal,
  medium: textStyles.weightMedium,
  semibold: textStyles.weightSemibold,
  bold: textStyles.weightBold,
  extrabold: textStyles.weightExtrabold,
  black: textStyles.weightBlack,
};

const alignStyles: Record<TextAlign, StyleXStyles> = {
  start: textStyles.alignStart,
  center: textStyles.alignCenter,
  end: textStyles.alignEnd,
};

export type TextProps = {
  as?: TextAs;
  tone?: TextTone;
  size?: TextSize;
  weight?: TextWeight;
  align?: TextAlign | null;
  truncate?: boolean;
  children?: ReactNode;
  id?: string;
};

function Text(props: TextProps) {
  const Component = props.as ?? "p";
  const tone = props.tone ?? "foreground";
  const size = props.size ?? "md";
  const weight = props.weight ?? "normal";
  const align = props.align ?? null;
  const truncate = props.truncate ?? false;

  return (
    <Component
      {...stylex.props(
        textStyles.base,
        toneStyles[tone],
        sizeStyles[size],
        weightStyles[weight],
        align === null ? null : alignStyles[align],
        truncate ? textStyles.truncate : null,
      )}
      data-slot="text"
      id={props.id}
    >
      {props.children}
    </Component>
  );
}

export { Text, textStyles };
