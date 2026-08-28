import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import {
  makeFunctionReference,
  type DefaultFunctionArgs,
  type PaginationResult,
} from "convex/server";
import * as React from "react";
import { expect, test, vi } from "vitest";

import { registerConvexInfiniteQueryClient } from "./convexInfiniteQuery";
import { testPreloadedConvexInfiniteQuery } from "./test-helpers";
import { usePreloadedConvexInfiniteQuery } from "./usePreloadedConvexInfiniteQuery";

type WatchHandle = {
  onUpdate: (cb: () => void) => () => void;
  localQueryResult: () => undefined;
};

type WatchQuery = (funcRef: unknown, args: DefaultFunctionArgs) => WatchHandle;

type TestInfinitePage = PaginationResult<{ id: string }>;

function idleWatchQuery() {
  return vi.fn<WatchQuery>(() => ({
    onUpdate: () => () => undefined,
    localQueryResult: () => undefined,
  }));
}

/**
 * `useConvex()` only reads context, so the real `ConvexProvider` happily
 * carries a `watchQuery`-shaped stand-in for the live-page subscriptions.
 */
function createWrapper(queryClient: QueryClient, watchQuery: WatchQuery) {
  const convex = { watchQuery } as unknown as ConvexReactClient;
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(
      ConvexProvider,
      { client: convex },
      React.createElement(QueryClientProvider, { client: queryClient }, props.children),
    );
  };
}

test("usePreloadedConvexInfiniteQuery reads preloaded pages and watches them", async () => {
  registerConvexInfiniteQueryClient({
    convexClient: { query: vi.fn<() => Promise<TestInfinitePage>>() },
    serverHttpClient: undefined,
  } as never);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const handle = testPreloadedConvexInfiniteQuery({
    input: { tag: "news" },
    numItems: 20,
    initialData: {
      pages: [{ page: [{ id: "1", tag: "news" }], isDone: true, continueCursor: "" }],
      pageParams: [{ numItems: 20, cursor: null }],
    },
  } as never);

  const watchQuery = idleWatchQuery();
  const { result } = renderHook(
    () =>
      usePreloadedConvexInfiniteQuery("posts:list" as never, {
        handle,
        remixArgs: null,
      }),
    { wrapper: createWrapper(queryClient, watchQuery) },
  );

  await waitFor(() => {
    expect(result.current.data.pages[0]).toEqual({
      page: [{ id: "1", tag: "news" }],
      isDone: true,
      continueCursor: "",
    });
  });
  expect(result.current.hasNextPage).toBe(false);
  // Built-in live sync: each loaded page gets a Convex watch
  expect(watchQuery).toHaveBeenCalledWith(makeFunctionReference("posts:list"), {
    tag: "news",
    paginationOpts: { numItems: 20, cursor: null },
  });
});

test("usePreloadedConvexInfiniteQuery fetches when the handle has no initialData", async () => {
  const query = vi.fn<() => Promise<TestInfinitePage>>(async () => ({
    page: [{ id: "fetched" }],
    isDone: true,
    continueCursor: "",
  }));
  registerConvexInfiniteQueryClient({
    convexClient: { query },
    serverHttpClient: undefined,
  } as never);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const initiatedHandle = { input: { tag: "news" }, numItems: 20 };
  const { result } = renderHook(
    () =>
      usePreloadedConvexInfiniteQuery("posts:listFresh" as never, {
        handle: initiatedHandle as never,
        remixArgs: null,
      }),
    { wrapper: createWrapper(queryClient, idleWatchQuery()) },
  );

  await waitFor(() => {
    expect(result.current.data.pages[0]).toEqual({
      page: [{ id: "fetched" }],
      isDone: true,
      continueCursor: "",
    });
  });
  expect(query).toHaveBeenCalledWith("posts:listFresh", {
    tag: "news",
    paginationOpts: { numItems: 20, cursor: null },
  });
});

test("usePreloadedConvexInfiniteQuery remixes args from local state", async () => {
  registerConvexInfiniteQueryClient({
    convexClient: { query: vi.fn<() => Promise<TestInfinitePage>>() },
    serverHttpClient: undefined,
  } as never);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const handle = testPreloadedConvexInfiniteQuery({
    input: { tag: "news" },
    numItems: 20,
    initialData: {
      pages: [{ page: [{ id: "1", tag: "news" }], isDone: true, continueCursor: "" }],
      pageParams: [{ numItems: 20, cursor: null }],
    },
  } as never);

  const watchQuery = idleWatchQuery();
  const { result } = renderHook(
    () =>
      usePreloadedConvexInfiniteQuery("posts:list" as never, {
        handle,
        remixArgs: (args) => ({ ...args, visitor: "v1" }),
      }),
    { wrapper: createWrapper(queryClient, watchQuery) },
  );

  await waitFor(() => {
    expect(result.current.data.pages).toHaveLength(1);
  });
  // Live watch uses the remixed args
  expect(watchQuery).toHaveBeenCalledWith(makeFunctionReference("posts:list"), {
    tag: "news",
    visitor: "v1",
    paginationOpts: { numItems: 20, cursor: null },
  });
});
