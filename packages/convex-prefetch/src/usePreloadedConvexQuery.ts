import { convexQuery } from "@convex-dev/react-query";
import { useQuery, useSuspenseQuery, type UseSuspenseQueryResult } from "@tanstack/react-query";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { InitiatedConvexQuery, PreloadedConvexQuery, QueryReference } from "./handles.js";

/**
 * Rebuilds `convexQuery(funcRef, handle.input)` options from a loader handle,
 * attaching `initialData` when the handle was awaited.
 */
export function preloadedConvexQueryOptions<TQuery extends QueryReference>(
  funcRef: TQuery,
  handle: InitiatedConvexQuery<TQuery> | PreloadedConvexQuery<TQuery>,
) {
  const options = convexQuery(funcRef, handle.input as never);
  if ("initialData" in handle) {
    return { ...options, initialData: handle.initialData };
  }
  return options;
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
  handle: InitiatedConvexQuery<TQuery> | PreloadedConvexQuery<TQuery>,
): UseSuspenseQueryResult<FunctionReturnType<TQuery>, Error> {
  return useSuspenseQuery(
    preloadedConvexQueryOptions(funcRef, handle) as never,
  ) as UseSuspenseQueryResult<FunctionReturnType<TQuery>, Error>;
}

/**
 * Starts a Convex query during render and returns an
 * {@link InitiatedConvexQuery} handle for `usePreloadedConvexQuery`. Reach for
 * this only when the input genuinely cannot be known until render (e.g. a
 * browser push endpoint); loaders should preload everything else.
 */
export function useInitiateConvexQuery<TQuery extends QueryReference>(
  funcRef: TQuery,
  args: FunctionArgs<TQuery>,
): InitiatedConvexQuery<TQuery> {
  const options = convexQuery(funcRef, args as never);

  // Start the fetch without subscribing; the downstream read surfaces data.
  useQuery({
    ...options,
    notifyOnChangeProps: [],
  } as unknown as Parameters<typeof useQuery>[0]);

  return { input: args } as InitiatedConvexQuery<TQuery>;
}
