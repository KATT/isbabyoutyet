import { expect, test } from "vitest";
import { htmlDate, htmlDateTime, htmlDateTimeNow, optionalHtmlDateTime } from "@/lib/html-date";

test("calendar date decode/encode roundtrips a YYYY-MM-DD picker value", () => {
  expect(htmlDate.decode("2026-09-01")).toBe("2026-09-01T00:00:00.000Z");
  expect(htmlDate.encode(htmlDate.decode("2026-09-01"))).toBe("2026-09-01");
});

test("calendar date encode accepts a stored ISO instant", () => {
  expect(htmlDate.encode("2026-09-01T00:00:00.000Z")).toBe("2026-09-01");
});

test("calendar date encode leaves a YYYY-MM-DD value unchanged", () => {
  expect(htmlDate.encode("2026-09-01")).toBe("2026-09-01");
});

test("datetime-local roundtrips an instant through the viewer's timezone", () => {
  const iso = "2026-08-10T07:30:00.000Z";
  expect(htmlDateTime.decode(htmlDateTime.encode(iso))).toBe(iso);
});

test("empty optional time means now (null)", () => {
  expect(optionalHtmlDateTime.decode("")).toBe(null);
  expect(optionalHtmlDateTime.encode(null)).toBe("");
});

test("optional time roundtrips a minute-precision instant", () => {
  const ms = Date.parse("2026-08-10T07:30:00.000Z");
  expect(optionalHtmlDateTime.decode(optionalHtmlDateTime.encode(ms))).toBe(ms);
});

test("optional time rejects a garbled value", () => {
  const result = optionalHtmlDateTime.safeDecode("not-a-date");
  expect(result.success).toBe(false);
});

test("datetime-local now is a picker-shaped local value", () => {
  expect(htmlDateTimeNow()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

test("calendar date rejects a non-date", () => {
  expect(htmlDate.safeDecode("nope").success).toBe(false);
});

test("datetime-local rejects an empty picker", () => {
  expect(htmlDateTime.safeDecode("").success).toBe(false);
});
