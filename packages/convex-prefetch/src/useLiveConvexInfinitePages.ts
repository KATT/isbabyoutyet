import { useEffect } from "react";
import { useQueryClient, type InfiniteData, type QueryKey } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import type { FunctionReference, PaginationOptions } from "convex/server";

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
  const pageParamsKey = JSON.stringify(opts.pageParams);
  const argsKey = JSON.stringify(opts.args);

  useEffect(() => {
    const unsubscribers = opts.pageParams.map((pageParam, index) => {
      const watch = convex.watchQuery(opts.funcRef, {
        ...opts.args,
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
          opts.queryKey,
          (previous: InfiniteData<LivePage, PaginationOptions> | undefined) => {
            if (!previous) {
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
  }, [
    argsKey,
    convex,
    opts.args,
    opts.funcRef,
    opts.pageParams,
    opts.queryKey,
    pageParamsKey,
    queryClient,
  ]);
}
