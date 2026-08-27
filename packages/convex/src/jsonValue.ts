/**
 * JSON value decoding without runtime `typeof` representation checks.
 * Prefer these parsers at I/O boundaries, then branch on the domain value.
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

export type JsonObject = { readonly [key: string]: JsonValue };

function tagOf(value: JsonValue | null | undefined) {
  return Object.prototype.toString.call(value);
}

export function isJsonObjectValue<TValue>(value: TValue): value is TValue & JsonObject {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function parseJsonString(value: JsonValue): string | null {
  if (
    value === null ||
    value === true ||
    value === false ||
    Array.isArray(value) ||
    tagOf(value) === "[object Object]"
  ) {
    return null;
  }
  const asText = `${value}`;
  if (asText !== value) {
    return null;
  }
  return asText;
}

export function parseJsonNumber(value: JsonValue): number | null {
  if (
    value === null ||
    value === true ||
    value === false ||
    Array.isArray(value) ||
    tagOf(value) === "[object Object]"
  ) {
    return null;
  }
  const asText = `${value}`;
  if (asText === value) {
    return null;
  }
  return Number(asText);
}

export function parseJsonBoolean(value: JsonValue): boolean | null {
  if (value === true || value === false) {
    return value;
  }
  return null;
}

/** Decode a loosely typed adapter/API field that should be a string when present. */
export function parseOptionalString(value: JsonValue | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  return parseJsonString(value);
}
