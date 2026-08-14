import type { QueryClient } from "@tanstack/react-query";
import type {
  PreloadedInfiniteQuery,
  PreloadedQuery,
  QueryInputArgs,
  QueryOptionsFactory,
} from "./types.js";

/**
 * Awaits loader queries and returns handles with `initialData`.
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
