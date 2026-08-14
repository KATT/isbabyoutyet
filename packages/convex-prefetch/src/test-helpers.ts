import type { FunctionArgs, FunctionReturnType, PaginationOptions } from "convex/server";
import type { InfiniteData } from "@tanstack/react-query";
import type { PaginatedQueryReference, PaginationArgs } from "./convexInfiniteQuery.js";
import type {
  PreloadedConvexInfiniteQuery,
  PreloadedConvexQuery,
  QueryReference,
} from "./handles.js";

/** Builds a typed {@link PreloadedConvexQuery} handle for unit tests. */
export function testPreloadedConvexQuery<TQuery extends QueryReference>(opts: {
  input: FunctionArgs<TQuery>;
  initialData: FunctionReturnType<TQuery>;
}): PreloadedConvexQuery<TQuery> {
  return { input: opts.input, initialData: opts.initialData } as PreloadedConvexQuery<TQuery>;
}

/** Builds a typed {@link PreloadedConvexInfiniteQuery} handle for unit tests. */
export function testPreloadedConvexInfiniteQuery<TQuery extends PaginatedQueryReference>(opts: {
  input: PaginationArgs<TQuery>;
  numItems: number;
  initialData: InfiniteData<FunctionReturnType<TQuery>, PaginationOptions>;
}): PreloadedConvexInfiniteQuery<TQuery> {
  return {
    input: opts.input,
    numItems: opts.numItems,
    initialData: opts.initialData,
  } as PreloadedConvexInfiniteQuery<TQuery>;
}
