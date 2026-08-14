import {
  useSuspenseInfiniteQuery,
  type InfiniteData,
  type UseSuspenseInfiniteQueryResult,
} from "@tanstack/react-query";
import type { FunctionReturnType, PaginationOptions } from "convex/server";
import { convexInfiniteQuery } from "./convexInfiniteQuery.js";
import type { PaginatedQueryReference, PaginationArgs } from "./convexInfiniteQuery.js";
import type { InitiatedConvexInfiniteQuery, PreloadedConvexInfiniteQuery } from "./handles.js";
import { useLiveConvexInfinitePages } from "./useLiveConvexInfinitePages.js";

/**
 * `useSuspenseInfiniteQuery` over a paginated Convex loader handle, with live
 * Convex `watchQuery` sync for every loaded page built in.
 *
 * `remixArgs` transforms the handle's stored args at the read site — for input
 * held in local component state the URL doesn't capture (e.g. `visitorId`).
 * The first render should be an identity transform so it matches the
 * preloaded key.
 *
 * @example
 * const timelineQuery = usePreloadedConvexInfiniteQuery(api.timeline.listByBaby, {
 *   handle: loaderData.timeline,
 *   remixArgs: null,
 * });
 * const items = timelineQuery.data.pages.flatMap((page) => page.page);
 */
export function usePreloadedConvexInfiniteQuery<TQuery extends PaginatedQueryReference>(
  funcRef: TQuery,
  opts: {
    handle: InitiatedConvexInfiniteQuery<TQuery> | PreloadedConvexInfiniteQuery<TQuery>;
    remixArgs: ((args: PaginationArgs<TQuery>) => PaginationArgs<TQuery>) | null;
  },
): UseSuspenseInfiniteQueryResult<
  InfiniteData<FunctionReturnType<TQuery>, PaginationOptions>,
  Error
> {
  const args = opts.remixArgs ? opts.remixArgs(opts.handle.input) : opts.handle.input;
  const options = convexInfiniteQuery(funcRef, {
    args,
    initialNumItems: opts.handle.numItems,
  });
  const optionsWithInitialData =
    "initialData" in opts.handle ? { ...options, initialData: opts.handle.initialData } : options;

  const result = useSuspenseInfiniteQuery(
    optionsWithInitialData as never,
  ) as UseSuspenseInfiniteQueryResult<
    InfiniteData<FunctionReturnType<TQuery>, PaginationOptions>,
    Error
  >;

  useLiveConvexInfinitePages({
    queryKey: options.queryKey,
    funcRef,
    args: args as Record<string, unknown>,
    pageParams: result.data.pageParams,
  });

  return result;
}
