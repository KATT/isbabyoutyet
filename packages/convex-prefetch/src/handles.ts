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
 * Fire-and-forget handle for a Convex query started in a loader (or during
 * render via {@link useInitiateConvexQuery}). Serializable: stores only the
 * function args; the brand is type-only.
 */
export interface InitiatedConvexQuery<TQuery extends QueryReference> {
  readonly input: FunctionArgs<TQuery>;
  readonly [convexQueryBrand]?: TQuery;
}

/** Awaited loader handle for a Convex query; carries `initialData`. */
export interface PreloadedConvexQuery<
  TQuery extends QueryReference,
> extends InitiatedConvexQuery<TQuery> {
  readonly initialData: FunctionReturnType<TQuery>;
}

/**
 * Fire-and-forget handle for a paginated Convex query. `numItems` is stored so
 * the read site can rebuild the same `initialPageParam` without re-declaring
 * the page size.
 */
export interface InitiatedConvexInfiniteQuery<TQuery extends PaginatedQueryReference> {
  readonly input: PaginationArgs<TQuery>;
  readonly numItems: number;
  readonly [convexInfiniteQueryBrand]?: TQuery;
}

/** Awaited loader handle for a paginated Convex query. */
export interface PreloadedConvexInfiniteQuery<
  TQuery extends PaginatedQueryReference,
> extends InitiatedConvexInfiniteQuery<TQuery> {
  readonly initialData: InfiniteData<FunctionReturnType<TQuery>, PaginationOptions>;
}
