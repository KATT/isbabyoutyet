import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { makeFunctionReference } from "convex/server";
import * as React from "react";
import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const watchQuery = vi.fn<
    () => {
      onUpdate: (cb: () => void) => () => void;
      localQueryResult: () => undefined;
    }
  >(() => ({
    onUpdate: (_cb: () => void) => () => undefined,
    localQueryResult: () => undefined,
  }));
  const convexClient = { watchQuery };
  return { watchQuery, convexClient };
});

vi.mock("convex/react", () => ({
  useConvex: () => mocks.convexClient,
}));

const { registerConvexInfiniteQueryClient } = await import("./convexInfiniteQuery");
const { usePreloadedConvexInfiniteQuery } = await import("./usePreloadedConvexInfiniteQuery");
const { testPreloadedConvexInfiniteQuery } = await import("./test-helpers");

function createWrapper(queryClient: QueryClient) {
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

test("usePreloadedConvexInfiniteQuery reads preloaded pages and watches them", async () => {
  registerConvexInfiniteQueryClient({
    convexClient: { query: vi.fn<() => Promise<unknown>>() },
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

  mocks.watchQuery.mockClear();
  const { result } = renderHook(
    () =>
      usePreloadedConvexInfiniteQuery("posts:list" as never, {
        handle,
        remixArgs: null,
      }),
    { wrapper: createWrapper(queryClient) },
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
  expect(mocks.watchQuery).toHaveBeenCalledWith(makeFunctionReference("posts:list"), {
    tag: "news",
    paginationOpts: { numItems: 20, cursor: null },
  });
});

test("usePreloadedConvexInfiniteQuery fetches when the handle has no initialData", async () => {
  const query = vi.fn<() => Promise<unknown>>(async () => ({
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
    { wrapper: createWrapper(queryClient) },
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
    convexClient: { query: vi.fn<() => Promise<unknown>>() },
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

  mocks.watchQuery.mockClear();
  const { result } = renderHook(
    () =>
      usePreloadedConvexInfiniteQuery("posts:list" as never, {
        handle,
        remixArgs: (args) => ({ ...args, visitor: "v1" }),
      }),
    { wrapper: createWrapper(queryClient) },
  );

  await waitFor(() => {
    expect(result.current.data.pages).toHaveLength(1);
  });
  // Live watch uses the remixed args
  expect(mocks.watchQuery).toHaveBeenCalledWith(makeFunctionReference("posts:list"), {
    tag: "news",
    visitor: "v1",
    paginationOpts: { numItems: 20, cursor: null },
  });
});
