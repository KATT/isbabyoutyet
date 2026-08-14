import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { expect, test } from "vitest";
import { infiniteQueryOptions } from "@tanstack/react-query";
import { testPreloadedInfiniteQuery } from "@workspace/query-prefetch/test-helpers";
import { usePreloadedConvexInfiniteQuery } from "./usePreloadedConvexInfiniteQuery";

const postsInfinite = (input: { tag: string }) =>
  infiniteQueryOptions({
    queryKey: ["posts", "infinite", input] as const,
    queryFn: async () => ({
      page: [{ id: "1", tag: input.tag }],
      isDone: true,
      continueCursor: "",
    }),
    initialPageParam: { numItems: 20, cursor: null },
    getNextPageParam: () => undefined,
  });

function createWrapper(queryClient: QueryClient) {
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

test("usePreloadedConvexInfiniteQuery reads preloaded infinite pages", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const handle = testPreloadedInfiniteQuery(
    postsInfinite,
    {
      pages: [{ page: [{ id: "1", tag: "news" }], isDone: true, continueCursor: "" }],
      pageParams: [{ numItems: 20, cursor: null }],
    },
    { tag: "news" },
  );
  queryClient.setQueryData(postsInfinite({ tag: "news" }).queryKey, handle.initialData);

  const { result } = renderHook(
    () =>
      usePreloadedConvexInfiniteQuery(postsInfinite, {
        handle,
        remixInput: null,
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
});

test("usePreloadedConvexInfiniteQuery remaps input when remixInput is provided", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const handle = testPreloadedInfiniteQuery(
    postsInfinite,
    {
      pages: [{ page: [{ id: "1", tag: "news" }], isDone: true, continueCursor: "" }],
      pageParams: [{ numItems: 20, cursor: null }],
    },
    { tag: "news" },
  );
  queryClient.setQueryData(postsInfinite({ tag: "live" }).queryKey, {
    pages: [{ page: [{ id: "2", tag: "live" }], isDone: true, continueCursor: "" }],
    pageParams: [{ numItems: 20, cursor: null }],
  });

  const { result } = renderHook(
    () =>
      usePreloadedConvexInfiniteQuery(postsInfinite, {
        handle,
        remixInput: () => ({ tag: "live" }) as never,
      }),
    { wrapper: createWrapper(queryClient) },
  );

  await waitFor(() => {
    expect(result.current.data.pages[0]).toEqual({
      page: [{ id: "2", tag: "live" }],
      isDone: true,
      continueCursor: "",
    });
  });
});
