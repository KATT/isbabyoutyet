import { expect, test } from "vitest";
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
