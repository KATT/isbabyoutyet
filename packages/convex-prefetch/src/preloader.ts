import { convexQuery } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { FunctionArgs } from "convex/server";
import { convexInfiniteQuery } from "./convexInfiniteQuery.js";
import type { PaginatedQueryReference, PaginationArgs } from "./convexInfiniteQuery.js";
import type {
  PreloadedConvexInfiniteQuery,
  PreloadedConvexQuery,
  QueryReference,
} from "./handles.js";

/**
 * Awaits Convex queries in a route loader and returns serializable handles.
 * The Convex function reference IS the interface — no per-query factory:
 *
 * @example
 * const preloader = getConvexQueryPreloader(opts.context.queryClient);
 * return await allKeyed({
 *   profile: preloader.ensureQueryData(api.profile.get, {}),
 *   timeline: preloader.ensureInfiniteQueryData(api.timeline.listByBaby, {
 *     args: { babyId },
 *     numItems: 20,
 *   }),
 * });
 *
 * function Page() {
 *   const loaderData = Route.useLoaderData();
 *   const profileQuery = usePreloadedConvexQuery(api.profile.get, loaderData.profile);
 *   // ...
 * }
 */
export function getConvexQueryPreloader(queryClient: QueryClient) {
  return {
    /** Awaits a Convex query and returns a {@link PreloadedConvexQuery} handle. */
    async ensureQueryData<TQuery extends QueryReference>(
      funcRef: TQuery,
      args: FunctionArgs<TQuery>,
    ): Promise<PreloadedConvexQuery<TQuery>> {
      const options = convexQuery(funcRef, args as never);
      const initialData = await queryClient.ensureQueryData(
        options as unknown as Parameters<QueryClient["ensureQueryData"]>[0],
      );
      return { input: args, initialData } as PreloadedConvexQuery<TQuery>;
    },

    /**
     * Awaits the first page of a paginated Convex query and returns a
     * {@link PreloadedConvexInfiniteQuery} handle.
     */
    async ensureInfiniteQueryData<TQuery extends PaginatedQueryReference>(
      funcRef: TQuery,
      opts: {
        args: PaginationArgs<TQuery>;
        numItems: number;
      },
    ): Promise<PreloadedConvexInfiniteQuery<TQuery>> {
      const options = convexInfiniteQuery(funcRef, {
        args: opts.args,
        initialNumItems: opts.numItems,
      });
      const initialData = await queryClient.ensureInfiniteQueryData(
        options as unknown as Parameters<QueryClient["ensureInfiniteQueryData"]>[0],
      );
      return {
        input: opts.args,
        numItems: opts.numItems,
        initialData,
      } as PreloadedConvexInfiniteQuery<TQuery>;
    },
  };
}
