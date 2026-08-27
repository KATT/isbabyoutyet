/**
 * Runtime representation guards for unparsed external values.
 * `typeof` checks live only in this module at the I/O boundary.
 */

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === "function";
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
