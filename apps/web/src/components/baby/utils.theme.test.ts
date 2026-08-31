import { expect, test } from "vitest";
import { BABY_BLUE_THEME } from "@workspace/convex/src/theme";
import {
  getThemeColors,
  getThemeCss,
  getThemeOption,
  getThemePrimaryColor,
  THEME_OPTIONS,
} from "./utils";

test("getThemeCss returns null for the default theme and unknown names", () => {
  expect(getThemeCss(null)).toBeNull();
  expect(getThemeCss(undefined)).toBeNull();
  expect(getThemeCss("not-a-real-theme")).toBeNull();
  expect(getThemeColors("not-a-real-theme")).toEqual(["#ea580c", "#fef3c7", "#fed7aa"]);
});

test("default theme option has no css payload", () => {
  expect(THEME_OPTIONS).toContainEqual(expect.objectContaining({ value: null, css: null }));
});

test("named themes expose a css string for head.styles injection", () => {
  expect(THEME_OPTIONS.filter((option) => option.value !== null)).toHaveLength(7);
  expect(getThemeCss("catppuccin")).toEqual(expect.any(String));
  expect(getThemeCss("sunny-days")).toEqual(expect.any(String));
});

test("getThemePrimaryColor matches known theme accents", () => {
  expect(getThemePrimaryColor("catppuccin")).toBe("#8839ef");
  expect(getThemePrimaryColor(null)).toBe("#ea580c");
});

test("Baby Blue uses the canonical name", () => {
  expect(BABY_BLUE_THEME).toBe("baby-blue");
  expect(getThemeOption("baby-blue")).toMatchObject({ labelKey: "Baby Blue" });
  expect(getThemeColors("baby-blue")).toEqual(["#1e9df1", "#ffffff", "#e3ecf6"]);
  expect(getThemePrimaryColor("baby-blue")).toBe("#1e9df1");
});
