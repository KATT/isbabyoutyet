import { useEffect } from "react";
import { useQueryClient, type InfiniteData, type QueryKey } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import {
  getFunctionName,
  makeFunctionReference,
  type FunctionReference,
  type PaginationOptions,
} from "convex/server";

type LivePage = {
  page: unknown[];
  isDone: boolean;
  continueCursor: string;
};

/**
 * Keeps TanStack infinite-query pages in sync with Convex watch subscriptions.
 * Each loaded `pageParam` gets its own `watchQuery`; updates patch that page
 * in the infinite-query cache (SSR-friendly infinite queries aren't covered
 * by ConvexQueryClient yet).
 */
export function useLiveConvexInfinitePages(opts: {
  queryKey: QueryKey;
  funcRef: FunctionReference<"query">;
  args: Record<string, unknown>;
  pageParams: PaginationOptions[];
}) {
  const queryClient = useQueryClient();
  const convex = useConvex();
  // Serialize every identity-unstable input so the effect resubscribes only
  // when contents change: callers rebuild `args`/`pageParams`/`queryKey` each
  // render, and `funcRef` from the generated `api` proxy is a new object per
  // property access. `getFunctionName` gives a stable string for the same
  // function; `makeFunctionReference` rebuilds an equivalent ref inside.
  const pageParamsKey = JSON.stringify(opts.pageParams);
  const argsKey = JSON.stringify(opts.args);
  const queryKeyKey = JSON.stringify(opts.queryKey);
  const funcName = getFunctionName(opts.funcRef);

  useEffect(() => {
    const funcRef = makeFunctionReference<"query">(funcName);
    // TanStack hashes keys structurally, so a parsed clone targets the same
    // cache entry as the caller's original key.
    const queryKey = JSON.parse(queryKeyKey) as QueryKey;
    const pageParams = JSON.parse(pageParamsKey) as PaginationOptions[];
    const args = JSON.parse(argsKey) as Record<string, unknown>;
    const unsubscribers = pageParams.map((pageParam, index) => {
      const watch = convex.watchQuery(funcRef, {
        ...args,
        paginationOpts: pageParam,
      });
      return watch.onUpdate(() => {
        let value: LivePage | undefined;
        try {
          value = watch.localQueryResult() as LivePage | undefined;
        } catch {
          return;
        }
        if (value === undefined) {
          return;
        }
        queryClient.setQueryData(
          queryKey,
          (previous: InfiniteData<LivePage, PaginationOptions> | undefined) => {
            if (!previous) {
              return previous;
            }
            if (index >= previous.pages.length) {
              return previous;
            }
            const pages = [...previous.pages];
            pages[index] = value;
            return { ...previous, pages };
          },
        );
      });
    });

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [argsKey, convex, funcName, pageParamsKey, queryClient, queryKeyKey]);
}
