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
  initialData: FunctionReturnType<TQuery>;
  input: FunctionArgs<TQuery>;
}): PreloadedConvexQuery<TQuery> {
  // SAFETY: Handle brands are type-only; input/initialData are the runtime fields.
  return { initialData: opts.initialData, input: opts.input } as PreloadedConvexQuery<TQuery>;
}

/** Builds a typed {@link PreloadedConvexInfiniteQuery} handle for unit tests. */
export function testPreloadedConvexInfiniteQuery<TQuery extends PaginatedQueryReference>(opts: {
  initialData: InfiniteData<FunctionReturnType<TQuery>, PaginationOptions>;
  input: PaginationArgs<TQuery>;
  numItems: number;
}): PreloadedConvexInfiniteQuery<TQuery> {
  // SAFETY: Test fixture is a subset of the production type.
  return {
    initialData: opts.initialData,
    input: opts.input,
    numItems: opts.numItems,
  } as PreloadedConvexInfiniteQuery<TQuery>;
}
