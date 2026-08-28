import { describe, expect, test } from "vitest";
import {
  isJsonObjectValue,
  parseJsonBoolean,
  parseJsonNumber,
  parseJsonString,
  parseOptionalString,
} from "./jsonValue";

describe("jsonValue parsers", () => {
  test("isJsonObjectValue accepts plain objects and rejects arrays/null/primitives", () => {
    expect(isJsonObjectValue({ a: 1 })).toBe(true);
    expect(isJsonObjectValue([])).toBe(false);
    expect(isJsonObjectValue(null)).toBe(false);
    expect(isJsonObjectValue("x")).toBe(false);
    expect(isJsonObjectValue(1)).toBe(false);
  });

  test("parseJsonString accepts strings and rejects other JSON values", () => {
    expect(parseJsonString("hi")).toBe("hi");
    expect(parseJsonString("")).toBe("");
    expect(parseJsonString(null)).toBe(null);
    expect(parseJsonString(true)).toBe(null);
    expect(parseJsonString(1)).toBe(null);
    expect(parseJsonString([])).toBe(null);
    expect(parseJsonString({})).toBe(null);
  });

  test("parseJsonNumber accepts finite numbers and rejects strings/objects", () => {
    expect(parseJsonNumber(0)).toBe(0);
    expect(parseJsonNumber(12.5)).toBe(12.5);
    expect(parseJsonNumber("12")).toBe(null);
    expect(parseJsonNumber(null)).toBe(null);
    expect(parseJsonNumber(true)).toBe(null);
    expect(parseJsonNumber([])).toBe(null);
    expect(parseJsonNumber({})).toBe(null);
  });

  test("parseJsonBoolean accepts only booleans", () => {
    expect(parseJsonBoolean(true)).toBe(true);
    expect(parseJsonBoolean(false)).toBe(false);
    expect(parseJsonBoolean(null)).toBe(null);
    expect(parseJsonBoolean(0)).toBe(null);
    expect(parseJsonBoolean("true")).toBe(null);
  });

  test("parseOptionalString treats undefined as null and delegates otherwise", () => {
    expect(parseOptionalString(undefined)).toBe(null);
    expect(parseOptionalString("ok")).toBe("ok");
    expect(parseOptionalString(null)).toBe(null);
    expect(parseOptionalString(1)).toBe(null);
  });
});
