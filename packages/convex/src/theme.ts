export const BABY_BLUE_THEME = "baby-blue";
export const LEGACY_BABY_BLUE_THEME = "twitter";

/**
 * Keeps pages saved by older clients on the canonical Baby Blue theme during
 * the data-migration window.
 */
export function normalizeTheme(theme: string | null | undefined) {
  return theme === LEGACY_BABY_BLUE_THEME ? BABY_BLUE_THEME : theme;
}
