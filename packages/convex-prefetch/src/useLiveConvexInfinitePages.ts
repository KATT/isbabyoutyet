import { useState, useSyncExternalStore } from "react";
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

type WatchDeps = {
  queryKey: QueryKey;
  args: Record<string, unknown>;
  pageParams: PaginationOptions[];
  funcName: string;
  queryClient: ReturnType<typeof useQueryClient>;
  convex: ReturnType<typeof useConvex>;
};

function createSubscribe(deps: WatchDeps) {
  return (notify: () => void) => {
    const funcRef = makeFunctionReference<"query">(deps.funcName);
    const unsubscribers = deps.pageParams.map((pageParam, index) => {
      const watch = deps.convex.watchQuery(funcRef, {
        ...deps.args,
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
        deps.queryClient.setQueryData(
          deps.queryKey,
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
        notify();
      });
    });

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  };
}

/**
 * Keeps TanStack infinite-query pages in sync with Convex watch subscriptions.
 * Each loaded `pageParam` gets its own `watchQuery`; updates patch that page
 * in the infinite-query cache (SSR-friendly infinite queries aren't covered
 * by ConvexQueryClient yet).
 *
 * Package-internal — used by {@link usePreloadedConvexInfiniteQuery} only.
 *
 * Uses render-time useState adjustment (React’s “adjusting state when props
 * change” pattern) so subscribe identity stays stable without reading refs
 * during render (banned by react/refs).
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
  // `replaceEqualDeep` keeps the previous identity when contents match so we
  // resubscribe only on real changes (no JSON stringify/parse).
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

  const watchDeps: WatchDeps = {
    queryKey: snapshot.queryKey,
    args: snapshot.args,
    pageParams: snapshot.pageParams,
    funcName,
    queryClient,
    convex,
  };

  // Keep a stable `subscribe` identity across renders when watch inputs are
  // unchanged (useSyncExternalStore resubscribes when `subscribe` changes).
  // Adjust during render — same pattern as the snapshot above — so we do not
  // need useEffect / useCallback (banned by no-use-effect / no-manual-memo).
  const [subscription, setSubscription] = useState(() => ({
    deps: watchDeps,
    subscribe: createSubscribe(watchDeps),
  }));
  if (
    watchDeps.queryKey !== subscription.deps.queryKey ||
    watchDeps.args !== subscription.deps.args ||
    watchDeps.pageParams !== subscription.deps.pageParams ||
    watchDeps.funcName !== subscription.deps.funcName ||
    watchDeps.queryClient !== subscription.deps.queryClient ||
    watchDeps.convex !== subscription.deps.convex
  ) {
    setSubscription({
      deps: watchDeps,
      subscribe: createSubscribe(watchDeps),
    });
  }

  useSyncExternalStore(
    subscription.subscribe,
    () => 0,
    () => 0,
  );
}
