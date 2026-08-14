import {
  useSuspenseInfiniteQuery,
  type InfiniteData,
  type UseSuspenseInfiniteQueryResult,
} from "@tanstack/react-query";
import {
  preloadedInfiniteQueryOptions,
  type InitiatedInfiniteQuery,
  type PreloadedInfiniteQuery,
  type QueryOptionsFactory,
} from "@workspace/query-prefetch";
import type { PaginationOptions } from "convex/server";

/**
 * `useSuspenseInfiniteQuery` + query-prefetch handle for Convex cursor pages.
 *
 * TanStack's infinite `DataTag` drops the page-param generic (so handles type
 * `pageParams` as `unknown[]`); this restores {@link PaginationOptions}.
 * Callers cast `data.pages` to the Convex pagination result type.
 */
export function usePreloadedConvexInfiniteQuery(
  factory: QueryOptionsFactory,
  opts: {
    handle:
      | InitiatedInfiniteQuery<QueryOptionsFactory>
      | PreloadedInfiniteQuery<QueryOptionsFactory>;
    remixInput: ((input: never) => never) | null;
  },
): UseSuspenseInfiniteQueryResult<InfiniteData<unknown, PaginationOptions>, Error> {
  const options = preloadedInfiniteQueryOptions(
    factory,
    opts.handle as never,
    opts.remixInput === null ? undefined : (opts.remixInput as never),
  );

  // Cast once: DataTag types InfiniteData pageParams as `unknown`.
  return useSuspenseInfiniteQuery(options as never) as UseSuspenseInfiniteQueryResult<
    InfiniteData<unknown, PaginationOptions>,
    Error
  >;
}
