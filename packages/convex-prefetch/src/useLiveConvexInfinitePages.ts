import { useRef, useSyncExternalStore } from "react";
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
          value = watch.localQueryResult() as LivePage | undefined;
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
  const snapshotRef = useRef<LivePagesSnapshot>({
    queryKey: opts.queryKey,
    args: opts.args,
    pageParams: opts.pageParams,
  });
  const nextQueryKey = replaceEqualDeep(snapshotRef.current.queryKey, opts.queryKey);
  const nextArgs = replaceEqualDeep(snapshotRef.current.args, opts.args);
  const nextPageParams = replaceEqualDeep(snapshotRef.current.pageParams, opts.pageParams);
  if (
    nextQueryKey !== snapshotRef.current.queryKey ||
    nextArgs !== snapshotRef.current.args ||
    nextPageParams !== snapshotRef.current.pageParams
  ) {
    snapshotRef.current = {
      queryKey: nextQueryKey,
      args: nextArgs,
      pageParams: nextPageParams,
    };
  }

  const snapshot = snapshotRef.current;
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
  // Parent re-renders drive dependency checks — no useState needed.
  const subscriptionRef = useRef<{
    deps: WatchDeps;
    subscribe: (notify: () => void) => () => void;
  } | null>(null);
  if (
    !subscriptionRef.current ||
    watchDeps.queryKey !== subscriptionRef.current.deps.queryKey ||
    watchDeps.args !== subscriptionRef.current.deps.args ||
    watchDeps.pageParams !== subscriptionRef.current.deps.pageParams ||
    watchDeps.funcName !== subscriptionRef.current.deps.funcName ||
    watchDeps.queryClient !== subscriptionRef.current.deps.queryClient ||
    watchDeps.convex !== subscriptionRef.current.deps.convex
  ) {
    subscriptionRef.current = {
      deps: watchDeps,
      subscribe: createSubscribe(watchDeps),
    };
  }

  useSyncExternalStore(
    subscriptionRef.current.subscribe,
    () => 0,
    () => 0,
  );
}
