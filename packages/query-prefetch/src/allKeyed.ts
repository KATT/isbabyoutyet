/**
 * Ponyfill for the Stage 3 TC39 `Promise.allKeyed` proposal
 * (https://github.com/tc39/proposal-await-dictionary).
 *
 * Resolves an object of promises concurrently and returns a new object with
 * the same own enumerable keys and awaited values (null prototype).
 */
export async function allKeyed<T extends Record<PropertyKey, unknown>>(
  promises: T,
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const keys = Reflect.ownKeys(promises) as Array<keyof T>;
  const values = await Promise.all(keys.map((key) => promises[key]));
  const result = Object.create(null) as { [K in keyof T]: Awaited<T[K]> };
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) {
      continue;
    }
    result[key] = values[index] as Awaited<T[typeof key]>;
  }
  return result;
}
