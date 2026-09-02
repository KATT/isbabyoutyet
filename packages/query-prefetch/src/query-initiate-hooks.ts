import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { isFunction } from "@workspace/runtime/guards";
import type {
  AnyQueryOptions,
  InitiatedInfiniteQuery,
  InitiatedQuery,
  QueryFactoryInput,
  QueryInput,
  QueryInputArgs,
  QueryOptionsFactory,
} from "./types.js";

/** Page cursor/offset at the untyped infinite-query options boundary. */
type InfiniteQueryPageParam = string | number | boolean | null | object;

interface AnyInfiniteQueryOptions extends AnyQueryOptions {
  getNextPageParam(
    ...args: [
      lastPage: unknown,
      allPages: Array<unknown>,
      lastPageParam: InfiniteQueryPageParam,
      allPageParams: Array<InfiniteQueryPageParam>,
    ]
  ): InfiniteQueryPageParam | null | undefined;
  initialPageParam: InfiniteQueryPageParam;
}

type RuntimeQueryOptionsFactory = {
  bivarianceHack(input: QueryFactoryInput): AnyQueryOptions;
}["bivarianceHack"];

function invokeFactory<TFactory extends QueryOptionsFactory>(
  factory: TFactory,
  input: QueryInput<TFactory> | undefined,
): ReturnType<TFactory>;
function invokeFactory(
  factory: RuntimeQueryOptionsFactory,
  // oxlint-disable-next-line typescript/no-explicit-any -- overload implementation
  input: any,
) {
  return factory(input);
}

type RuntimeInitiatedQuery = {
  input?: unknown;
};

function createInitiatedQuery<TFactory extends QueryOptionsFactory>(
  factory: TFactory,
  input: QueryInputArgs<TFactory>,
): InitiatedQuery<TFactory>;
function createInitiatedQuery(
  _factory: RuntimeQueryOptionsFactory,
  input: ReadonlyArray<unknown>,
): RuntimeInitiatedQuery {
  return { input: input[0] };
}

function createInitiatedInfiniteQuery<TFactory extends QueryOptionsFactory>(
  factory: TFactory,
  input: QueryInputArgs<TFactory>,
): InitiatedInfiniteQuery<TFactory>;
function createInitiatedInfiniteQuery(
  _factory: RuntimeQueryOptionsFactory,
  input: ReadonlyArray<unknown>,
): RuntimeInitiatedQuery {
  return { input: input[0] };
}

function isInfiniteQueryOptions(options: AnyQueryOptions): options is AnyInfiniteQueryOptions {
  return (
    "initialPageParam" in options &&
    "getNextPageParam" in options &&
    isFunction(options.getNextPageParam)
  );
}

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
  const options = invokeFactory(factory, input[0]);

  // Start the fetch on render without subscribing to updates; the read
  // downstream (via `preloadedQueryOptions`) is what surfaces data and errors.
  useQuery({
    ...options,
    notifyOnChangeProps: [],
  });

  return createInitiatedQuery(factory, input);
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
  const options = invokeFactory(factory, input[0]);

  if (!isInfiniteQueryOptions(options)) {
    throw new TypeError("Infinite query options require page parameters");
  }

  useInfiniteQuery({
    ...options,
    notifyOnChangeProps: [],
  });

  return createInitiatedInfiniteQuery(factory, input);
}
