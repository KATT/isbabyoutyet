/**
 * Explicit resource management helper for tests.
 */
export function makeAsyncResource<T>(thing: T, dispose: () => Promise<void>): T & AsyncDisposable {
  const resource = thing as T & Partial<AsyncDisposable>;

  // eslint-disable-next-line no-restricted-syntax -- dedicated resource helper
  const existing = resource[Symbol.asyncDispose];

  // eslint-disable-next-line no-restricted-syntax -- dedicated resource helper
  resource[Symbol.asyncDispose] = async () => {
    await dispose();
    await existing?.();
  };

  return resource as T & AsyncDisposable;
}
