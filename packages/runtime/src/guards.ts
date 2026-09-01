/**
 * Runtime representation guards for unparsed external values.
 * `typeof` is allowed here via `no-runtime-typeof` + `allowInTypeGuards`
 * (see oxlint-plugins/no-runtime-typeof.test.ts).
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

export function isFunction(value: unknown): value is (...args: Array<never>) => unknown {
  return typeof value === "function";
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
