import { useEffect, useState } from "react";
import {
  replaceEqualDeep,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
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

type LivePagesSnapshot = {
  queryKey: QueryKey;
  args: Record<string, unknown>;
  pageParams: PaginationOptions[];
};

/**
 * Keeps TanStack infinite-query pages in sync with Convex watch subscriptions.
 * Each loaded `pageParam` gets its own `watchQuery`; updates patch that page
 * in the infinite-query cache (SSR-friendly infinite queries aren't covered
 * by ConvexQueryClient yet).
 *
 * Package-internal — used by {@link usePreloadedConvexInfiniteQuery} only.
 */
export function useLiveConvexInfinitePages(opts: {
  queryKey: QueryKey;
  funcRef: FunctionReference<"query">;
  args: Record<string, unknown>;
  pageParams: PaginationOptions[];
}) {
  const queryClient = useQueryClient();
  const convex = useConvex();
  // Callers rebuild `args`/`pageParams`/`queryKey` each render, and `funcRef`
  // from the generated `api` proxy is a new object per property access.
  // `replaceEqualDeep` keeps the previous identity when contents match so the
  // effect resubscribes only on real changes (no JSON stringify/parse).
  // `getFunctionName` / `makeFunctionReference` stabilize the function ref.
  const funcName = getFunctionName(opts.funcRef);
  const [snapshot, setSnapshot] = useState<LivePagesSnapshot>(() => ({
    queryKey: opts.queryKey,
    args: opts.args,
    pageParams: opts.pageParams,
  }));
  const nextQueryKey = replaceEqualDeep(snapshot.queryKey, opts.queryKey);
  const nextArgs = replaceEqualDeep(snapshot.args, opts.args);
  const nextPageParams = replaceEqualDeep(snapshot.pageParams, opts.pageParams);
  if (
    nextQueryKey !== snapshot.queryKey ||
    nextArgs !== snapshot.args ||
    nextPageParams !== snapshot.pageParams
  ) {
    setSnapshot({
      queryKey: nextQueryKey,
      args: nextArgs,
      pageParams: nextPageParams,
    });
  }

  const queryKey = snapshot.queryKey;
  const args = snapshot.args;
  const pageParams = snapshot.pageParams;

  useEffect(() => {
    const funcRef = makeFunctionReference<"query">(funcName);
    const unsubscribers = pageParams.map((pageParam, index) => {
      const watch = convex.watchQuery(funcRef, {
        ...args,
        paginationOpts: pageParam,
      });
      return watch.onUpdate(() => {
        let value: LivePage | undefined;
        try {
          value = watch.localQueryResult();
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
  }, [args, convex, funcName, pageParams, queryClient, queryKey]);
}
