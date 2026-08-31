import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import {
  makeFunctionReference,
  type DefaultFunctionArgs,
  type FunctionReference,
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

type WatchQuery = (funcRef: FunctionReference<"query">, args: DefaultFunctionArgs) => WatchHandle;

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
  // @ts-expect-error — stand-in only implements watchQuery
  const convex: ConvexReactClient = { watchQuery };
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
    // @ts-expect-error — fixture only implements query
    convexClient: { query: vi.fn<() => Promise<TestInfinitePage>>() },
    serverHttpClient: undefined,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const handle = testPreloadedConvexInfiniteQuery({
    input: { tag: "news" },
    numItems: 20,
    initialData: {
      pages: [{ page: [{ id: "1", tag: "news" }], isDone: true, continueCursor: "" }],
      pageParams: [{ numItems: 20, cursor: null }],
    },
  });

  const watchQuery = idleWatchQuery();
  const { result } = renderHook(
    () =>
      // @ts-expect-error — string is not a FunctionReference
      usePreloadedConvexInfiniteQuery("posts:list", {
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
    // @ts-expect-error — fixture only implements query
    convexClient: { query },
    serverHttpClient: undefined,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const initiatedHandle = { input: { tag: "news" }, numItems: 20 };
  const { result } = renderHook(
    () =>
      // @ts-expect-error — string is not a FunctionReference
      usePreloadedConvexInfiniteQuery("posts:listFresh", {
        handle: initiatedHandle,
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
    // @ts-expect-error — fixture only implements query
    convexClient: { query: vi.fn<() => Promise<TestInfinitePage>>() },
    serverHttpClient: undefined,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const handle = testPreloadedConvexInfiniteQuery({
    input: { tag: "news" },
    numItems: 20,
    initialData: {
      pages: [{ page: [{ id: "1", tag: "news" }], isDone: true, continueCursor: "" }],
      pageParams: [{ numItems: 20, cursor: null }],
    },
  });

  const watchQuery = idleWatchQuery();
  const { result } = renderHook(
    () =>
      // @ts-expect-error — string is not a FunctionReference
      usePreloadedConvexInfiniteQuery("posts:list", {
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
