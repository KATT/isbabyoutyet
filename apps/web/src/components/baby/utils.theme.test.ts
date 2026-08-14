import { expect, test } from "vitest";
import { getThemeCss, getThemePrimaryColor, THEME_OPTIONS } from "./utils";

test("getThemeCss returns null for the default theme and unknown names", () => {
  expect(getThemeCss(null)).toBeNull();
  expect(getThemeCss(undefined)).toBeNull();
  expect(getThemeCss("not-a-real-theme")).toBeNull();
});

test("named themes expose a css string for head.styles injection", () => {
  for (const option of THEME_OPTIONS) {
    if (option.value === null) {
      expect(option.css).toBeNull();
      continue;
    }
    // Vitest stubs CSS module imports as ""; Vite `?raw` returns file text in the app.
    expect(typeof option.css).toBe("string");
    expect(getThemeCss(option.value)).toBe(option.css);
  }
});

test("getThemePrimaryColor matches known theme accents", () => {
  expect(getThemePrimaryColor("catppuccin")).toBe("#8839ef");
  expect(getThemePrimaryColor(null)).toBe("#ea580c");
});
