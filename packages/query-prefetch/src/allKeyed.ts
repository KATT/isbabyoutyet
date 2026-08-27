/**
 * Ponyfill for the Stage 3 TC39 `Promise.allKeyed` proposal
 * (https://github.com/tc39/proposal-await-dictionary).
 *
 * Resolves an object of promises concurrently and returns a new object with
 * the same own enumerable keys and awaited values (null prototype).
 */
type AllKeyedEntry =
  | PromiseLike<unknown>
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

export function allKeyed<T extends Record<PropertyKey, AllKeyedEntry>>(
  promises: T,
): Promise<{ [K in keyof T]: Awaited<T[K]> }>;
export async function allKeyed(promises: Record<PropertyKey, AllKeyedEntry>) {
  const keys = Reflect.ownKeys(promises);
  const values = await Promise.all(keys.map((key) => promises[key]));
  const result = Object.create(null);
  for (const [index, key] of keys.entries()) {
    result[key] = values[index];
  }
  return result;
}
