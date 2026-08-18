/**
 * Ponyfill for the Stage 3 TC39 `Promise.allKeyed` proposal
 * (https://github.com/tc39/proposal-await-dictionary).
 *
 * Resolves an object of promises concurrently and returns a new object with
 * the same own enumerable keys and awaited values (null prototype).
 */
export function allKeyed<T extends Record<PropertyKey, unknown>>(
  promises: T,
): Promise<{ [K in keyof T]: Awaited<T[K]> }>;
export async function allKeyed(promises: Record<PropertyKey, unknown>) {
  const keys = Reflect.ownKeys(promises);
  const values = await Promise.all(keys.map((key) => promises[key]));
  const result: Record<PropertyKey, unknown> = Object.create(null);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) {
      continue;
    }
    result[key] = values[index];
  }
  return result;
}
