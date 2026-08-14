import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  InitiatedInfiniteQuery,
  InitiatedQuery,
  QueryInputArgs,
  QueryOptionsFactory,
} from "./types.js";

/**
 * Starts a query during render and returns an {@link InitiatedQuery} handle, so
 * the rest of the tree consumes it through `preloadedQueryOptions(...)` exactly
 * like a loader-initiated handle — either passed down as a prop or read
 * immediately via `useSuspenseQuery(preloadedQueryOptions(factory, handle))`.
 *
 * Last resort — a component-side waterfall is a second round trip keyed off
 * render-time data. Prefer reading the input from the route/search params (so
 * the loader can prefetch it) or getting the backend to return it alongside its
 * dependency. Reach for this only when the input genuinely cannot be known until
 * render (e.g. an id pulled from a parent query's result).
 */
export function useInitiateQuery<TFactory extends QueryOptionsFactory>(
  factory: TFactory,
  ...input: QueryInputArgs<TFactory>
): InitiatedQuery<TFactory> {
  const options = factory(input[0] as never);

  // Start the fetch on render without subscribing to updates; the read
  // downstream (via `preloadedQueryOptions`) is what surfaces data and errors.
  useQuery({
    ...options,
    notifyOnChangeProps: [],
  } as unknown as Parameters<typeof useQuery>[0]);

  return { input: input[0] } as InitiatedQuery<TFactory>;
}

/**
 * Infinite-query counterpart of {@link useInitiateQuery}: starts an infinite
 * query during render and returns an {@link InitiatedInfiniteQuery} handle.
 * Same component-side-waterfall caveats apply.
 */
export function useInitiateInfiniteQuery<TFactory extends QueryOptionsFactory>(
  factory: TFactory,
  ...input: QueryInputArgs<TFactory>
): InitiatedInfiniteQuery<TFactory> {
  const options = factory(input[0] as never);

  useInfiniteQuery({
    ...options,
    notifyOnChangeProps: [],
  } as unknown as Parameters<typeof useInfiniteQuery>[0]);

  return { input: input[0] } as InitiatedInfiniteQuery<TFactory>;
}
