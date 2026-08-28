import { convexQuery } from "@convex-dev/react-query";
import {
  useQuery,
  useSuspenseQuery,
  type UseSuspenseQueryOptions,
  type UseSuspenseQueryResult,
} from "@tanstack/react-query";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { InitiatedConvexQuery, PreloadedConvexQuery, QueryReference } from "./handles.js";

type ConvexQueryOptions<TQuery extends QueryReference> = Pick<
  UseSuspenseQueryOptions<
    FunctionReturnType<TQuery>,
    Error,
    FunctionReturnType<TQuery>,
    ["convexQuery", TQuery, FunctionArgs<TQuery>]
  >,
  "queryKey" | "queryFn" | "staleTime"
>;

function liveConvexQuery<TQuery extends QueryReference>(
  funcRef: TQuery,
  args: FunctionArgs<TQuery>,
): ConvexQueryOptions<TQuery>;
function liveConvexQuery<TQuery extends QueryReference>(
  funcRef: TQuery,
  args: FunctionArgs<TQuery>,
) {
  return convexQuery(funcRef, args);
}

/**
 * Rebuilds `convexQuery(funcRef, handle.input)` options from a loader handle,
 * attaching `initialData` when the handle was awaited.
 */
export function preloadedConvexQueryOptions<TQuery extends QueryReference>(
  funcRef: TQuery,
  handle: InitiatedConvexQuery<TQuery> | PreloadedConvexQuery<TQuery>,
) {
  const options = liveConvexQuery(funcRef, handle.input);
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
  return useSuspenseQuery(preloadedConvexQueryOptions(funcRef, handle));
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
  const options = liveConvexQuery(funcRef, args);

  // Start the fetch without subscribing; the downstream read surfaces data.
  useQuery({
    ...options,
    notifyOnChangeProps: [],
  });

  return { input: args };
}
