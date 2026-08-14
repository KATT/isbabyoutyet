import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery, type UseSuspenseQueryResult } from "@tanstack/react-query";
import type { FunctionReturnType } from "convex/server";
import type { PreloadedConvexQuery, QueryReference } from "./handles.js";

/**
 * Rebuilds `convexQuery(funcRef, handle.input)` options from a loader handle,
 * attaching the handle's `initialData`.
 */
export function preloadedConvexQueryOptions<TQuery extends QueryReference>(
  funcRef: TQuery,
  handle: PreloadedConvexQuery<TQuery>,
) {
  const options = convexQuery(funcRef, handle.input as never);
  return { ...options, initialData: handle.initialData };
}

/**
 * `useSuspenseQuery` over a Convex loader handle — the function reference is
 * the only interface, no per-query factory required.
 *
 * @example
 * const profileQuery = usePreloadedConvexQuery(api.profile.get, loaderData.profile);
 */
export function usePreloadedConvexQuery<TQuery extends QueryReference>(
  funcRef: TQuery,
  handle: PreloadedConvexQuery<TQuery>,
): UseSuspenseQueryResult<FunctionReturnType<TQuery>, Error> {
  return useSuspenseQuery(
    preloadedConvexQueryOptions(funcRef, handle) as never,
  ) as UseSuspenseQueryResult<FunctionReturnType<TQuery>, Error>;
}
