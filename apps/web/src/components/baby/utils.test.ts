import { expect, test } from "vitest";
import { useFakeTimersResource } from "./test-helpers";
import {
  formatDate,
  getDaysUntilDueDate,
  getOverdueDays,
  getRelativeTime,
  getThemeCssUrl,
  getThemePrimaryColor,
  parseDate,
} from "./utils";

test("getThemeCssUrl resolves themed css and falls back to null", () => {
  expect(getThemeCssUrl(null)).toBeNull();
  expect(getThemeCssUrl(undefined)).toBeNull();
  // Vite resolves `?url` css imports to a string (empty in the test build)
  expect(getThemeCssUrl("twitter")).toEqual(expect.any(String));
  expect(getThemeCssUrl("unknown-theme")).toBeNull();
});

test("getThemePrimaryColor resolves the theme color and falls back to orange", () => {
  expect(getThemePrimaryColor(null)).toBe("#ea580c");
  expect(getThemePrimaryColor("twitter")).toBe("#1e9df1");
  expect(getThemePrimaryColor("unknown-theme")).toBe("#ea580c");
});

test("formatDate renders in the configured timezone", () => {
  expect(formatDate("2026-08-11T12:00:00.000Z")).toContain("August 11, 2026");
});

test("parseDate parses ISO strings", () => {
  expect(parseDate("2026-08-11T12:00:00.000Z").toISOString()).toBe("2026-08-11T12:00:00.000Z");
});

test("getRelativeTime covers past, future and just-now", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  expect(getRelativeTime("2026-08-11T08:00:00.000Z")).toBe("4 hours ago");
  expect(getRelativeTime("2026-08-13T12:00:00.000Z")).toBe("in 2 days");
  expect(getRelativeTime("2026-08-11T12:00:00.500Z")).toBe("now");
});

test("getDaysUntilDueDate and getOverdueDays count calendar days", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  expect(getDaysUntilDueDate("2026-09-01")).toBe(21);
  expect(getOverdueDays("2026-09-01")).toBe(0);
  expect(getDaysUntilDueDate("2026-08-01")).toBe(-10);
  expect(getOverdueDays("2026-08-01")).toBe(10);
});
