import { convexQuery } from "@convex-dev/react-query";
import {
  useSuspenseQuery,
  type QueryClient,
  type UseSuspenseQueryResult,
} from "@tanstack/react-query";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

type ConvexQueryRef = FunctionReference<"query">;

type EnsureConvexQueryOptions<TQuery extends ConvexQueryRef> = {
  queryClient: QueryClient;
  queryRef: TQuery;
  args: FunctionArgs<TQuery>;
};

/**
 * Typed wrapper around `convexQuery` + `useSuspenseQuery`.
 * `@convex-dev/react-query`'s options factory currently loses `FunctionReturnType`
 * through TanStack Query's generics in this repo's TS config, so we re-assert it.
 */
export function useConvexSuspenseQuery<TQuery extends ConvexQueryRef>(
  queryRef: TQuery,
  args: FunctionArgs<TQuery>,
): UseSuspenseQueryResult<FunctionReturnType<TQuery>> {
  // Cast through unknown: convexQuery's overload union (skip vs args) doesn't
  // narrow cleanly into UseSuspenseQueryOptions for generic TQuery.
  return useSuspenseQuery(convexQuery(queryRef, args) as never) as UseSuspenseQueryResult<
    FunctionReturnType<TQuery>
  >;
}

/** Prefetch/ensure a Convex query in a route loader with correct return typing. */
export function ensureConvexQuery<TQuery extends ConvexQueryRef>(
  opts: EnsureConvexQueryOptions<TQuery>,
): Promise<FunctionReturnType<TQuery>> {
  return opts.queryClient.ensureQueryData(
    convexQuery(opts.queryRef, opts.args) as never,
  ) as Promise<FunctionReturnType<TQuery>>;
}
