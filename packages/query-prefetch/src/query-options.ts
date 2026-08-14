import type {
  PreloadedInfiniteQuery,
  PreloadedQuery,
  QueryDataOf,
  QueryInput,
  QueryOptionsFactory,
} from "./types.js";

type OptionsWithInitialData<TFactory extends QueryOptionsFactory> = Omit<
  ReturnType<TFactory>,
  "initialData"
> & {
  initialData: QueryDataOf<ReturnType<TFactory>>;
};

/**
 * Transforms the handle's stored input into the input the options are rebuilt
 * with — e.g. layering a local `sortDirection` onto a loader handle.
 * Returning a different input changes the query key, so the read fetches the
 * remixed variant; on the unremixed first render the key matches the
 * preloaded query.
 *
 * Last resort — prefer driving the input from the route/search params so the
 * loader re-runs and prefetches the right variant. Remix only when the varying
 * input lives in local component state (`useState`) the URL doesn't capture.
 *
 * Note for preloaded handles: `initialData` corresponds to the handle's original
 * input, so only remix a preloaded handle when the first render is the identity
 * transform.
 */
type RemixInput<TFactory extends QueryOptionsFactory> = (
  input: QueryInput<TFactory>,
) => QueryInput<TFactory>;

/**
 * Rebuilds query options from a preloaded handle. Handles include
 * `initialData`, so `useQuery(...)` infers defined data.
 *
 * @example
 * export async function clientLoader() {
 *   const queryPreloader = getQueryPreloader(queryClient);
 *   return {
 *     post: await queryPreloader.ensureQueryData(postById, { postId }),
 *   };
 * }
 *
 * function PostRoute() {
 *   const loaderData = useLoaderData<typeof clientLoader>();
 *   const postQuery = useQuery(
 *     preloadedQueryOptions(postById, loaderData.post),
 *   );
 *   return <Post post={postQuery.data} />;
 * }
 */
export function preloadedQueryOptions<TFactory extends QueryOptionsFactory>(
  factory: TFactory,
  preloadedQuery: NoInfer<PreloadedQuery<TFactory>>,
  remixInput?: RemixInput<TFactory>,
): OptionsWithInitialData<TFactory> {
  const input = remixInput
    ? remixInput(preloadedQuery.input as QueryInput<TFactory>)
    : preloadedQuery.input;
  const options = factory(input as never) as ReturnType<typeof factory>;
  return {
    ...options,
    initialData: preloadedQuery.initialData,
  };
}

/**
 * Infinite-query counterpart of {@link preloadedQueryOptions}.
 */
export function preloadedInfiniteQueryOptions<TFactory extends QueryOptionsFactory>(
  factory: TFactory,
  preloadedQuery: NoInfer<PreloadedInfiniteQuery<TFactory>>,
  remixInput?: RemixInput<TFactory>,
): OptionsWithInitialData<TFactory> {
  const input = remixInput
    ? remixInput(preloadedQuery.input as QueryInput<TFactory>)
    : preloadedQuery.input;
  const options = factory(input as never) as ReturnType<typeof factory>;
  return {
    ...options,
    initialData: preloadedQuery.initialData,
  };
}
