import type {
  AnyQueryOptions,
  InitiatedInfiniteQuery,
  InitiatedQuery,
  PreloadedInfiniteQuery,
  PreloadedQuery,
  QueryDataOf,
  QueryFactoryInput,
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
 * with — e.g. layering a local `sortDirection` onto a loader-initiated handle.
 * Returning a different input changes the query key, so the read fetches the
 * remixed variant; on the unremixed first render the key matches the initiated
 * query.
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

type RuntimeQueryOptionsFactory = {
  bivarianceHack(input: QueryFactoryInput): AnyQueryOptions;
}["bivarianceHack"];

function resolveInput<TFactory extends QueryOptionsFactory>(
  preloadedQuery: { readonly input?: QueryInput<TFactory> },
  remixInput: RemixInput<TFactory> | undefined,
): QueryInput<TFactory> | undefined;
function resolveInput(preloadedQuery: { readonly input?: unknown }, remixInput: any) {
  return remixInput ? remixInput(preloadedQuery.input) : preloadedQuery.input;
}

function invokeFactory<TFactory extends QueryOptionsFactory>(
  factory: TFactory,
  input: QueryInput<TFactory> | undefined,
): ReturnType<TFactory>;
function invokeFactory(factory: RuntimeQueryOptionsFactory, input: any) {
  return factory(input);
}

/**
 * Rebuilds query options from an initiated or preloaded handle.
 *
 * Initiated handles work well with `useSuspenseQuery(...)`; preloaded handles
 * include `initialData`, so `useQuery(...)` infers defined data.
 *
 * @example
 * export async function clientLoader() {
 *   const queryInitiator = getQueryInitiator(queryClient, { onError });
 *   return {
 *     post: queryInitiator.ensureQueryData(postById, { postId }),
 *   };
 * }
 *
 * function PostRoute() {
 *   const loaderData = useLoaderData<typeof clientLoader>();
 *   const postQuery = useSuspenseQuery(
 *     preloadedQueryOptions(postById, loaderData.post),
 *   );
 *   return <Post post={postQuery.data} />;
 * }
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
): OptionsWithInitialData<TFactory>;
export function preloadedQueryOptions<TFactory extends QueryOptionsFactory>(
  factory: TFactory,
  preloadedQuery: NoInfer<InitiatedQuery<TFactory>>,
  remixInput?: RemixInput<TFactory>,
): ReturnType<TFactory>;
export function preloadedQueryOptions<TFactory extends QueryOptionsFactory>(
  factory: TFactory,
  preloadedQuery: NoInfer<InitiatedQuery<TFactory> | PreloadedQuery<TFactory>>,
  remixInput?: RemixInput<TFactory>,
): ReturnType<TFactory> | OptionsWithInitialData<TFactory> {
  const input = resolveInput(preloadedQuery, remixInput);
  const options = invokeFactory(factory, input);
  if ("initialData" in preloadedQuery) {
    return {
      ...options,
      initialData: preloadedQuery.initialData,
    };
  }
  return options;
}

/**
 * Infinite-query counterpart of {@link preloadedQueryOptions}.
 *
 * @example
 * export async function clientLoader() {
 *   const queryInitiator = getQueryInitiator(queryClient, { onError });
 *   return {
 *     posts: queryInitiator.ensureInfiniteQueryData(postsInfinite, params),
 *   };
 * }
 *
 * function PostsRoute() {
 *   const loaderData = useLoaderData<typeof clientLoader>();
 *   const postsQuery = useSuspenseInfiniteQuery(
 *     preloadedInfiniteQueryOptions(postsInfinite, loaderData.posts),
 *   );
 *   return <Posts pages={postsQuery.data.pages} />;
 * }
 */
export function preloadedInfiniteQueryOptions<TFactory extends QueryOptionsFactory>(
  factory: TFactory,
  preloadedQuery: NoInfer<PreloadedInfiniteQuery<TFactory>>,
  remixInput?: NoInfer<RemixInput<TFactory>>,
): OptionsWithInitialData<TFactory>;
export function preloadedInfiniteQueryOptions<TFactory extends QueryOptionsFactory>(
  factory: TFactory,
  preloadedQuery: NoInfer<InitiatedInfiniteQuery<TFactory>>,
  remixInput?: NoInfer<RemixInput<TFactory>>,
): ReturnType<TFactory>;
export function preloadedInfiniteQueryOptions<TFactory extends QueryOptionsFactory>(
  factory: TFactory,
  preloadedQuery: NoInfer<InitiatedInfiniteQuery<TFactory> | PreloadedInfiniteQuery<TFactory>>,
  remixInput?: RemixInput<TFactory>,
): ReturnType<TFactory> | OptionsWithInitialData<TFactory> {
  const input = resolveInput(preloadedQuery, remixInput);
  const options = invokeFactory(factory, input);
  if ("initialData" in preloadedQuery) {
    return {
      ...options,
      initialData: preloadedQuery.initialData,
    };
  }
  return options;
}
