/**
 * JSON value decoding without scattering runtime representation checks.
 * Prefer these parsers at I/O boundaries, then branch on the domain value.
 */

import { isBoolean, isNumber, isPlainObject, isString } from "./guards.js";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

export type JsonObject = { readonly [key: string]: JsonValue };

function isJsonString(value: JsonValue): value is string {
  return isString(value);
}

function isJsonNumber(value: JsonValue): value is number {
  return isNumber(value);
}

function isJsonBoolean(value: JsonValue): value is boolean {
  return isBoolean(value);
}

export function isJsonObjectValue<TValue>(value: TValue): value is TValue & JsonObject {
  return isPlainObject(value);
}

export function parseJsonString(value: JsonValue): string | null {
  if (!isJsonString(value)) {
    return null;
  }
  return value;
}

export function parseJsonNumber(value: JsonValue): number | null {
  if (!isJsonNumber(value)) {
    return null;
  }
  return value;
}

export function parseJsonBoolean(value: JsonValue): boolean | null {
  if (!isJsonBoolean(value)) {
    return null;
  }
  return value;
}

/** Decode a loosely typed adapter/API field that should be a string when present. */
export function parseOptionalString(value: JsonValue | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  return parseJsonString(value);
}
