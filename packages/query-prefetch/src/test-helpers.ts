import type {
  PreloadedInfiniteQuery,
  PreloadedQuery,
  QueryDataOf,
  QueryInputArgs,
  QueryOptionsFactory,
} from "./types.js";

/**
 * Builds a typed {@link PreloadedQuery} handle with `initialData` for tests
 * without talking to a QueryClient. Pass the same factory the production code
 * uses so the handle's brand matches at the read site.
 */
export function testPreloadedQuery<TFactory extends QueryOptionsFactory>(
  _factory: TFactory,
  initialData: QueryDataOf<ReturnType<TFactory>>,
  ...input: QueryInputArgs<TFactory>
): PreloadedQuery<TFactory> {
  return { input: input[0], initialData } as PreloadedQuery<TFactory>;
}

/** Infinite-query counterpart of {@link testPreloadedQuery}. */
export function testPreloadedInfiniteQuery<TFactory extends QueryOptionsFactory>(
  _factory: TFactory,
  initialData: QueryDataOf<ReturnType<TFactory>>,
  ...input: QueryInputArgs<TFactory>
): PreloadedInfiniteQuery<TFactory> {
  return { input: input[0], initialData } as PreloadedInfiniteQuery<TFactory>;
}
