import type { QueryClient } from "@tanstack/react-query";
import type {
  InitiatedInfiniteQuery,
  InitiatedQuery,
  PreloadedInfiniteQuery,
  PreloadedQuery,
  QueryInputArgs,
  QueryOptionsFactory,
} from "./types.js";

interface OnErrorFnOptions {
  error: unknown;
}

type OnError = (options: OnErrorFnOptions) => void;

function noop(): void {}

/**
 * Starts loader queries without blocking navigation. Returned initiated handles
 * only store the input, so loader data stays serializable.
 *
 * Use {@link getQueryPreloader} instead when later params depend on loaded data.
 *
 * @example
 * const queryInitiator = getQueryInitiator(queryClient, { onError });
 * return {
 *   post: queryInitiator.ensureQueryData(postById, { postId }),
 * };
 *
 * function PostRoute() {
 *   const loaderData = useLoaderData<typeof clientLoader>();
 *   const postQuery = useSuspenseQuery(
 *     preloadedQueryOptions(postById, loaderData.post),
 *   );
 *   return <Post post={postQuery.data} />;
 * }
 */
export function getQueryInitiator(
  queryClient: QueryClient,
  initiatorOptions: { onError?: OnError } = {},
) {
  const onError = initiatorOptions.onError ?? noop;

  return {
    /**
     * Starts `queryClient.ensureQueryData(...)` in the background and returns an
     * {@link InitiatedQuery} handle for route data.
     *
     * @example
     * const post = queryInitiator.ensureQueryData(postById, { postId });
     *
     * function PostRoute() {
     *   const postQuery = useSuspenseQuery(
     *     preloadedQueryOptions(postById, post),
     *   );
     *   return <Post post={postQuery.data} />;
     * }
     */
    ensureQueryData<TFactory extends QueryOptionsFactory>(
      factory: TFactory,
      ...input: QueryInputArgs<TFactory>
    ): InitiatedQuery<TFactory> {
      const options = factory(input[0] as never);
      queryClient
        .ensureQueryData(options as unknown as Parameters<QueryClient["ensureQueryData"]>[0])
        .catch((error: unknown) => onError({ error }));
      return { input: input[0] } as InitiatedQuery<TFactory>;
    },

    /**
     * Starts `queryClient.ensureInfiniteQueryData(...)` in the background and
     * returns an {@link InitiatedInfiniteQuery} handle.
     *
     * @example
     * const posts = queryInitiator.ensureInfiniteQueryData(postsInfinite, params);
     *
     * function PostsRoute() {
     *   const postsQuery = useSuspenseInfiniteQuery(
     *     preloadedInfiniteQueryOptions(postsInfinite, posts),
     *   );
     *   return <Posts pages={postsQuery.data.pages} />;
     * }
     */
    ensureInfiniteQueryData<TFactory extends QueryOptionsFactory>(
      factory: TFactory,
      ...input: QueryInputArgs<TFactory>
    ): InitiatedInfiniteQuery<TFactory> {
      const options = factory(input[0] as never);
      queryClient
        .ensureInfiniteQueryData(
          options as unknown as Parameters<QueryClient["ensureInfiniteQueryData"]>[0],
        )
        .catch((error: unknown) => onError({ error }));
      return { input: input[0] } as InitiatedInfiniteQuery<TFactory>;
    },
  };
}

/**
 * Awaits loader queries and returns handles with `initialData`.
 *
 * Use {@link getQueryInitiator} for fire-and-forget cache warming.
 *
 * @example
 * const queryPreloader = getQueryPreloader(queryClient);
 * const post = await queryPreloader.ensureQueryData(postById, { postId });
 * const authorId = post.initialData.authorId;
 *
 * function PostRoute() {
 *   const loaderData = useLoaderData<typeof clientLoader>();
 *   const postQuery = useQuery(
 *     preloadedQueryOptions(postById, loaderData.post),
 *   );
 *   return <Post post={postQuery.data} />;
 * }
 */
export function getQueryPreloader(queryClient: QueryClient) {
  return {
    /**
     * Awaits `queryClient.ensureQueryData(...)` and returns a
     * {@link PreloadedQuery} handle with `initialData`.
     *
     * @example
     * const post = await queryPreloader.ensureQueryData(postById, { postId });
     *
     * function PostRoute() {
     *   const postQuery = useQuery(
     *     preloadedQueryOptions(postById, post),
     *   );
     *   return <Post post={postQuery.data} />;
     * }
     */
    async ensureQueryData<TFactory extends QueryOptionsFactory>(
      factory: TFactory,
      ...input: QueryInputArgs<TFactory>
    ): Promise<PreloadedQuery<TFactory>> {
      const options = factory(input[0] as never);
      const initialData = await queryClient.ensureQueryData(
        options as unknown as Parameters<QueryClient["ensureQueryData"]>[0],
      );
      return {
        input: input[0],
        initialData,
      } as PreloadedQuery<TFactory>;
    },

    /**
     * Awaits `queryClient.ensureInfiniteQueryData(...)` and returns a
     * {@link PreloadedInfiniteQuery} handle with `initialData`.
     *
     * @example
     * const posts = await queryPreloader.ensureInfiniteQueryData(postsInfinite, params);
     *
     * function PostsRoute() {
     *   const postsQuery = useQuery(
     *     preloadedInfiniteQueryOptions(postsInfinite, posts),
     *   );
     *   return <Posts pages={postsQuery.data.pages} />;
     * }
     */
    async ensureInfiniteQueryData<TFactory extends QueryOptionsFactory>(
      factory: TFactory,
      ...input: QueryInputArgs<TFactory>
    ): Promise<PreloadedInfiniteQuery<TFactory>> {
      const options = factory(input[0] as never);
      const initialData = await queryClient.ensureInfiniteQueryData(
        options as unknown as Parameters<QueryClient["ensureInfiniteQueryData"]>[0],
      );
      return {
        input: input[0],
        initialData,
      } as PreloadedInfiniteQuery<TFactory>;
    },
  };
}
