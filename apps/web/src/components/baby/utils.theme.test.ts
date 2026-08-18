import { expect, test } from "vitest";
import { BABY_BLUE_THEME, LEGACY_BABY_BLUE_THEME } from "@workspace/convex/src/theme";
import { getThemeCss, getThemePrimaryColor, THEME_OPTIONS } from "./utils";

test("getThemeCss returns null for the default theme and unknown names", () => {
  expect(getThemeCss(null)).toBeNull();
  expect(getThemeCss(undefined)).toBeNull();
  expect(getThemeCss("not-a-real-theme")).toBeNull();
});

test("default theme option has no css payload", () => {
  expect(THEME_OPTIONS).toContainEqual(expect.objectContaining({ value: null, css: null }));
});

test("named themes expose a css string for head.styles injection", () => {
  const named = THEME_OPTIONS.filter((option) => option.value !== null);
  expect(named.length).toBeGreaterThan(0);
  expect(named.map((option) => typeof option.css)).toEqual(named.map(() => "string"));
  expect(named.map((option) => getThemeCss(option.value))).toEqual(
    named.map((option) => option.css),
  );
});

test("getThemePrimaryColor matches known theme accents", () => {
  expect(getThemePrimaryColor("catppuccin")).toBe("#8839ef");
  expect(getThemePrimaryColor(null)).toBe("#ea580c");
});

test("Baby Blue uses the canonical name while rendering legacy saved pages", () => {
  const babyBlue = THEME_OPTIONS.find((option) => option.value === BABY_BLUE_THEME);

  expect(babyBlue).toMatchObject({ labelKey: "Baby Blue" });
  expect(THEME_OPTIONS.map((option) => option.value)).not.toContain(LEGACY_BABY_BLUE_THEME);
  expect(getThemeCss(LEGACY_BABY_BLUE_THEME)).toBe(babyBlue?.css);
  expect(getThemePrimaryColor(LEGACY_BABY_BLUE_THEME)).toBe("#1e9df1");
});
