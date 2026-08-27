import * as stylex from "@stylexjs/stylex";

/**
 * Design tokens for the StyleX component set.
 *
 * Each token wraps the corresponding CSS custom property defined in the app's
 * global stylesheet (e.g. `--primary`). Theming therefore stays driven by the
 * class-based `.dark` toggle (next-themes) — flipping `.dark` updates the
 * underlying `--*` variables, which propagate through these tokens. Components
 * reference `colors.primary` / `radius.md` instead of stringly-typed
 * `var(--primary)` so token usage is typed and centralized.
 */
export const colors = stylex.defineVars({
  accent: "var(--accent)",
  accentForeground: "var(--accent-foreground)",
  background: "var(--background)",
  border: "var(--border)",
  card: "var(--card)",
  cardForeground: "var(--card-foreground)",
  destructive: "var(--destructive)",
  foreground: "var(--foreground)",
  input: "var(--input)",
  muted: "var(--muted)",
  mutedForeground: "var(--muted-foreground)",
  popover: "var(--popover)",
  popoverForeground: "var(--popover-foreground)",
  primary: "var(--primary)",
  primaryForeground: "var(--primary-foreground)",
  ring: "var(--ring)",
  secondary: "var(--secondary)",
  secondaryForeground: "var(--secondary-foreground)",
  sidebar: "var(--sidebar)",
  sidebarAccent: "var(--sidebar-accent)",
  sidebarAccentForeground: "var(--sidebar-accent-foreground)",
  sidebarBorder: "var(--sidebar-border)",
  sidebarForeground: "var(--sidebar-foreground)",
  sidebarPrimary: "var(--sidebar-primary)",
  sidebarPrimaryForeground: "var(--sidebar-primary-foreground)",
  sidebarRing: "var(--sidebar-ring)",
});

export const radius = stylex.defineVars({
  lg: "var(--radius)",
  md: "calc(var(--radius) - 2px)",
  sm: "calc(var(--radius) - 4px)",
  xl: "calc(var(--radius) + 4px)",
});

/** Spacing scale aligned with `--spacing` (0.25rem) from the shared theme. */
export const spacing = stylex.defineVars({
  none: "0px",
  px: "1px",
  s0_5: "calc(var(--spacing) * 0.5)",
  s1: "var(--spacing)",
  s1_5: "calc(var(--spacing) * 1.5)",
  s2: "calc(var(--spacing) * 2)",
  s2_5: "calc(var(--spacing) * 2.5)",
  s3: "calc(var(--spacing) * 3)",
  s4: "calc(var(--spacing) * 4)",
  s5: "calc(var(--spacing) * 5)",
  s6: "calc(var(--spacing) * 6)",
  s8: "calc(var(--spacing) * 8)",
  s10: "calc(var(--spacing) * 10)",
  s12: "calc(var(--spacing) * 12)",
  s16: "calc(var(--spacing) * 16)",
});
