import type { InferDataFromTag, QueryKey } from "@tanstack/react-query";

declare const initiatedQueryBrand: unique symbol;
declare const initiatedInfiniteQueryBrand: unique symbol;

/**
 * The minimal shape every TanStack `queryOptions(...)` /
 * `infiniteQueryOptions(...)` result satisfies. We only rely on `queryKey`,
 * which carries the `DataTag` that lets TanStack infer the resolved data +
 * error types when the options are passed to `useSuspenseQuery`.
 */
export interface AnyQueryOptions {
  queryKey: QueryKey;
}

/**
 * A function that builds query options from a single optional input — e.g.
 * `postById({ postId })` or a no-arg factory like `currentUnits()`. Factories
 * must take exactly zero or one argument; the `(input: never)` signature rejects
 * any factory that declares two or more parameters.
 */
export type QueryOptionsFactory<TOptions extends AnyQueryOptions = AnyQueryOptions> = {
  bivarianceHack(input: unknown): TOptions;
}["bivarianceHack"];

/**
 * The single argument a factory accepts (its only parameter), or `never` for a
 * no-arg factory.
 */
export type QueryInput<TFactory extends QueryOptionsFactory> = Parameters<TFactory>[number];

/**
 * The trailing argument list for passing a factory's input. A factory with a
 * required parameter forces the input; a no-arg or optional-arg factory makes it
 * optional. Spread as `...input: QueryInputArgs<TFactory>` so required inputs
 * stay required at the call site.
 */
export type QueryInputArgs<TFactory extends QueryOptionsFactory> =
  Parameters<TFactory> extends [unknown, ...unknown[]]
    ? [input: QueryInput<TFactory>]
    : [input?: QueryInput<TFactory>];

/**
 * Fire-and-forget loader handle. The query has been started, but data is not
 * guaranteed by render time; component reads may still suspend or be pending.
 */
export interface InitiatedQuery<TFactory extends QueryOptionsFactory> {
  readonly input?: QueryInput<TFactory>;
  readonly [initiatedQueryBrand]: TFactory;
}

/**
 * Fire-and-forget infinite-query loader handle. The initial page has been
 * started, but data is not guaranteed by render time.
 */
export interface InitiatedInfiniteQuery<TFactory extends QueryOptionsFactory> {
  readonly input?: QueryInput<TFactory>;
  readonly [initiatedInfiniteQueryBrand]: TFactory;
}

/**
 * Data type inferred from a query's `queryFn`. Used as the fallback for
 * {@link QueryDataOf} because the `queryKey` `DataTag`'s unique-symbol brand
 * does not always survive declaration emit across package boundaries (e.g. the
 * built `@squareup/dashboard-query` types), exactly as
 * `queryClient.ensureQueryData` falls back to the `queryFn` type.
 */
type QueryFnDataOf<TOptions extends AnyQueryOptions> = TOptions extends {
  queryFn?: (...args: never[]) => infer TReturn;
}
  ? Awaited<TReturn>
  : unknown;

/**
 * The data type a query resolves to: the `DataTag` on its `queryKey` when
 * available, otherwise the `queryFn` return type (for infinite queries the
 * DataTag carries the `InfiniteData<...>` wrapper).
 */
export type QueryDataOf<TOptions extends AnyQueryOptions> = InferDataFromTag<
  QueryFnDataOf<TOptions>,
  TOptions["queryKey"]
>;

/**
 * Awaited loader handle. The query completed in the loader and carries
 * `initialData`, allowing non-suspense `useQuery(...)` reads to infer data.
 */
export interface PreloadedQuery<
  TFactory extends QueryOptionsFactory,
> extends InitiatedQuery<TFactory> {
  readonly initialData: QueryDataOf<ReturnType<TFactory>>;
}

/**
 * Awaited infinite-query loader handle. The query completed in the loader and
 * carries the `InfiniteData` wrapper as `initialData`.
 */
export interface PreloadedInfiniteQuery<
  TFactory extends QueryOptionsFactory,
> extends InitiatedInfiniteQuery<TFactory> {
  readonly initialData: QueryDataOf<ReturnType<TFactory>>;
}
