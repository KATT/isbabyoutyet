import { describe, expect, test } from "vitest";
import { isBoolean, isFunction, isNumber, isPlainObject, isString } from "./guards";

describe("guards", () => {
  test("isString accepts only strings", () => {
    expect(isString("")).toBe(true);
    expect(isString("hi")).toBe(true);
    expect(isString(1)).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
  });

  test("isNumber accepts finite numbers", () => {
    expect(isNumber(0)).toBe(true);
    expect(isNumber(1.5)).toBe(true);
    expect(isNumber(Number.NaN)).toBe(false);
    expect(isNumber("1")).toBe(false);
  });

  test("isBoolean accepts only booleans", () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean(0)).toBe(false);
    expect(isBoolean("true")).toBe(false);
  });

  test("isFunction accepts sync and async callables", () => {
    expect(isFunction(() => {})).toBe(true);
    expect(isFunction(async () => {})).toBe(true);
    expect(isFunction({})).toBe(false);
    expect(isFunction(null)).toBe(false);
  });

  test("isPlainObject accepts records and rejects arrays/null", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject("x")).toBe(false);
  });
});
