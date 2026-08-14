import type { ConvexQueryClient } from "@convex-dev/react-query";
import {
  infiniteQueryOptions,
  type QueryFunctionContext,
  type QueryKey,
} from "@tanstack/react-query";
import {
  getFunctionName,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
  type PaginationOptions,
  type PaginationResult,
} from "convex/server";

/**
 * Query-key prefix for Convex paginated queries consumed via TanStack
 * `useSuspenseInfiniteQuery`. Distinct from `convexQuery` because each page
 * fetch carries `paginationOpts` in `pageParam`, not in the key.
 */
export const CONVEX_INFINITE_QUERY_KEY = "convexInfiniteQuery" as const;

/** Convex queries that accept `paginationOpts` and return a pagination result. */
export type PaginatedQueryReference = FunctionReference<
  "query",
  "public",
  { paginationOpts: PaginationOptions },
  PaginationResult<any>
>;

type PaginationArgs<TFunc extends PaginatedQueryReference> = Omit<
  FunctionArgs<TFunc>,
  "paginationOpts"
>;

let registeredClient: ConvexQueryClient | null = null;

/** Wire the app's ConvexQueryClient so infinite factories can fetch pages. */
export function registerConvexInfiniteQueryClient(client: ConvexQueryClient) {
  registeredClient = client;
}

function isConvexInfiniteQueryKey(
  queryKey: readonly unknown[],
): queryKey is [
  typeof CONVEX_INFINITE_QUERY_KEY,
  FunctionReference<"query">,
  Record<string, unknown>,
] {
  return queryKey.length >= 2 && queryKey[0] === CONVEX_INFINITE_QUERY_KEY;
}

async function fetchConvexInfinitePage(
  convexQueryClient: ConvexQueryClient,
  context: QueryFunctionContext<QueryKey, PaginationOptions>,
) {
  if (!isConvexInfiniteQueryKey(context.queryKey)) {
    throw new Error("Not a Convex infinite query key");
  }

  const pageParam = context.pageParam;
  if (!pageParam) {
    throw new Error("Convex infinite query requires an initialPageParam");
  }

  const func = context.queryKey[1];
  const args = context.queryKey[2];
  const queryArgs = { ...args, paginationOpts: pageParam };

  if (typeof window === "undefined") {
    const http = convexQueryClient.serverHttpClient;
    if (!http) {
      throw new Error("Convex SSR HTTP client is not available");
    }
    return await http.consistentQuery(func as never, queryArgs as never);
  }

  return await convexQueryClient.convexClient.query(func as never, queryArgs as never);
}

/**
 * Default `queryFn` that understands both regular `convexQuery` keys and
 * {@link convexInfiniteQuery} keys (merging `pageParam` into `paginationOpts`).
 */
export function convexInfiniteQueryFn(convexQueryClient: ConvexQueryClient) {
  const fallback = convexQueryClient.queryFn();
  return async (context: QueryFunctionContext<QueryKey, unknown>) => {
    if (!isConvexInfiniteQueryKey(context.queryKey)) {
      return fallback(context as never);
    }
    return fetchConvexInfinitePage(
      convexQueryClient,
      context as QueryFunctionContext<QueryKey, PaginationOptions>,
    );
  };
}

/**
 * Infinite-query options factory for Convex paginated queries.
 *
 * Call {@link registerConvexInfiniteQueryClient} from the router so `queryFn`
 * can reach the Convex client during SSR and on the client.
 */
export function convexInfiniteQuery(
  funcRef: PaginatedQueryReference,
  opts: {
    args: PaginationArgs<typeof funcRef>;
    initialNumItems: number;
  },
) {
  type Page = FunctionReturnType<typeof funcRef>;
  const initialPageParam: PaginationOptions = {
    numItems: opts.initialNumItems,
    cursor: null,
  };

  return infiniteQueryOptions({
    queryKey: [
      CONVEX_INFINITE_QUERY_KEY,
      getFunctionName(funcRef) as unknown as typeof funcRef,
      opts.args,
    ] as const,
    queryFn: async (context): Promise<Page> => {
      if (!registeredClient) {
        throw new Error("registerConvexInfiniteQueryClient() was not called");
      }
      return (await fetchConvexInfinitePage(
        registeredClient,
        context as QueryFunctionContext<QueryKey, PaginationOptions>,
      )) as Page;
    },
    initialPageParam,
    getNextPageParam: (...params: [Page, Page[], PaginationOptions]) => {
      const lastPage = params[0];
      const lastPageParam = params[2];
      if (lastPage.isDone) {
        return undefined;
      }
      return {
        numItems: lastPageParam.numItems,
        cursor: lastPage.continueCursor,
      };
    },
    staleTime: Infinity,
  });
}
