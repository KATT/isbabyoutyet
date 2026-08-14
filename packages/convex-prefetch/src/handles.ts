import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  PaginationOptions,
} from "convex/server";
import type { InfiniteData } from "@tanstack/react-query";
import type { PaginatedQueryReference, PaginationArgs } from "./convexInfiniteQuery.js";

declare const convexQueryBrand: unique symbol;
declare const convexInfiniteQueryBrand: unique symbol;

/** Public Convex query function reference. */
export type QueryReference = FunctionReference<"query", "public">;

/**
 * Awaited loader handle for a Convex query. Serializable: stores the function
 * args and the resolved `initialData`; the brand is type-only.
 */
export interface PreloadedConvexQuery<TQuery extends QueryReference> {
  readonly input: FunctionArgs<TQuery>;
  readonly initialData: FunctionReturnType<TQuery>;
  readonly [convexQueryBrand]?: TQuery;
}

/**
 * Awaited loader handle for a paginated Convex query. `numItems` is stored so
 * the read site can rebuild the same `initialPageParam` without re-declaring
 * the page size.
 */
export interface PreloadedConvexInfiniteQuery<TQuery extends PaginatedQueryReference> {
  readonly input: PaginationArgs<TQuery>;
  readonly numItems: number;
  readonly initialData: InfiniteData<FunctionReturnType<TQuery>, PaginationOptions>;
  readonly [convexInfiniteQueryBrand]?: TQuery;
}
