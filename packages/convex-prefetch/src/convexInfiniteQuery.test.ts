import { QueryClient } from "@tanstack/react-query";
import type { PaginationResult } from "convex/server";
import { expect, test, vi } from "vitest";
import {
  CONVEX_INFINITE_QUERY_KEY,
  convexInfiniteQuery,
  convexInfiniteQueryFn,
  registerConvexInfiniteQueryClient,
} from "./convexInfiniteQuery";

type TestInfinitePage = PaginationResult<object | string>;

test("convexInfiniteQuery builds cursor pagination options", () => {
  // @ts-expect-error — string is not a FunctionReference
  const options = convexInfiniteQuery("timeline:listByBaby", {
    args: { babyId: "baby-1" },
    initialNumItems: 20,
  });

  expect(options.queryKey[0]).toBe(CONVEX_INFINITE_QUERY_KEY);
  expect(options.initialPageParam).toEqual({ cursor: null, numItems: 20 });
  expect(
    options.getNextPageParam(
      { continueCursor: "c1", isDone: false, page: [] },
      [],
      { cursor: null, numItems: 20 },
      [],
    ),
  ).toEqual({ cursor: "c1", numItems: 20 });
  expect(
    options.getNextPageParam(
      { continueCursor: "c1", isDone: true, page: [] },
      [],
      { cursor: null, numItems: 20 },
      [],
    ),
  ).toBeUndefined();
});

test("convexInfiniteQuery queryFn uses the registered Convex client", async () => {
  const query = vi.fn<
    () => Promise<{ continueCursor: string; isDone: boolean; page: Array<unknown> }>
  >(async () => ({ continueCursor: "", isDone: true, page: ["row"] }));
  registerConvexInfiniteQueryClient({
    // @ts-expect-error — fixture only implements query
    convexClient: { query },
    serverHttpClient: undefined,
  });

  // @ts-expect-error — string is not a FunctionReference
  const options = convexInfiniteQuery("admin:listBabies", {
    args: { hideDemo: true },
    initialNumItems: 20,
  });
  const page = await options.queryFn!({
    client: new QueryClient(),
    direction: "forward",
    meta: undefined,
    pageParam: options.initialPageParam,
    queryKey: options.queryKey,
    signal: new AbortController().signal,
  });

  expect(query).toHaveBeenCalledWith("admin:listBabies", {
    hideDemo: true,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(page).toEqual({ continueCursor: "", isDone: true, page: ["row"] });
});

test("convexInfiniteQueryFn merges pageParam into paginationOpts", async () => {
  const query = vi.fn<
    () => Promise<{ continueCursor: string; isDone: boolean; page: Array<unknown> }>
  >(async () => ({ continueCursor: "", isDone: true, page: [] }));
  const convexQueryClient = {
    convexClient: { query },
    queryFn: () => async () => {
      throw new Error("fallback should not run");
    },
    serverHttpClient: undefined,
  };

  // @ts-expect-error — stand-in only implements queryFn/convexClient
  const queryFn = convexInfiniteQueryFn(convexQueryClient);
  const result = await queryFn({
    client: new QueryClient(),
    direction: "forward",
    meta: undefined,
    pageParam: { cursor: null, numItems: 20 },
    queryKey: [CONVEX_INFINITE_QUERY_KEY, "admin:listBabies", { hideDemo: true }],
    signal: new AbortController().signal,
  });

  expect(query).toHaveBeenCalledWith("admin:listBabies", {
    hideDemo: true,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(result).toEqual({ continueCursor: "", isDone: true, page: [] });
});

test("convexInfiniteQueryFn falls back for non-infinite keys", async () => {
  const fallback = vi.fn<() => Promise<string>>(async () => "ok");
  const convexQueryClient = {
    convexClient: { query: vi.fn<() => Promise<TestInfinitePage>>() },
    queryFn: () => fallback,
    serverHttpClient: undefined,
  };

  // @ts-expect-error — stand-in only implements queryFn/convexClient
  const queryFn = convexInfiniteQueryFn(convexQueryClient);
  const result = await queryFn({
    client: new QueryClient(),
    meta: undefined,
    pageParam: undefined,
    queryKey: ["convexQuery", "profile:get", {}],
    signal: new AbortController().signal,
  });

  expect(fallback).toHaveBeenCalled();
  expect(result).toBe("ok");
});

test("convexInfiniteQuery queryFn rejects when the client was never registered", async () => {
  // @ts-expect-error — client is intentionally missing
  registerConvexInfiniteQueryClient(null);
  // @ts-expect-error — string is not a FunctionReference
  const options = convexInfiniteQuery("admin:listBabies", {
    args: { hideDemo: true },
    initialNumItems: 20,
  });

  await expect(
    options.queryFn!({
      client: new QueryClient(),
      direction: "forward",
      meta: undefined,
      pageParam: options.initialPageParam,
      queryKey: options.queryKey,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow("registerConvexInfiniteQueryClient() was not called");
});

test("convexInfiniteQueryFn rejects without a pageParam", async () => {
  const convexQueryClient = {
    convexClient: { query: vi.fn<() => Promise<TestInfinitePage>>() },
    queryFn: () => async () => "unused",
    serverHttpClient: undefined,
  };
  // @ts-expect-error — stand-in only implements queryFn/convexClient
  const queryFn = convexInfiniteQueryFn(convexQueryClient);

  await expect(
    queryFn({
      client: new QueryClient(),
      direction: "forward",
      meta: undefined,
      pageParam: undefined,
      queryKey: [CONVEX_INFINITE_QUERY_KEY, "admin:listBabies", { hideDemo: true }],
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow("Convex infinite query requires an initialPageParam");
});

test("convexInfiniteQueryFn uses the SSR HTTP client when window is undefined", async () => {
  const consistentQuery = vi.fn<
    () => Promise<{ continueCursor: string; isDone: boolean; page: Array<unknown> }>
  >(async () => ({ continueCursor: "", isDone: true, page: ["ssr"] }));
  const convexQueryClient = {
    convexClient: { query: vi.fn<() => Promise<TestInfinitePage>>() },
    queryFn: () => async () => {
      throw new Error("fallback should not run");
    },
    serverHttpClient: { consistentQuery },
  };

  const originalWindow = globalThis.window;
  // Simulate SSR: drop `window` for this fetch.
  // @ts-expect-error — intentional delete for SSR branch
  delete globalThis.window;

  try {
    // @ts-expect-error — stand-in only implements queryFn/convexClient
    const queryFn = convexInfiniteQueryFn(convexQueryClient);
    const result = await queryFn({
      client: new QueryClient(),
      direction: "forward",
      meta: undefined,
      pageParam: { cursor: null, numItems: 20 },
      queryKey: [CONVEX_INFINITE_QUERY_KEY, "admin:listBabies", { hideDemo: true }],
      signal: new AbortController().signal,
    });

    expect(consistentQuery).toHaveBeenCalledWith("admin:listBabies", {
      hideDemo: true,
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(result).toEqual({ continueCursor: "", isDone: true, page: ["ssr"] });
  } finally {
    globalThis.window = originalWindow;
  }
});

test("convexInfiniteQueryFn rejects on SSR when the HTTP client is missing", async () => {
  const convexQueryClient = {
    convexClient: { query: vi.fn<() => Promise<TestInfinitePage>>() },
    queryFn: () => async () => "unused",
    serverHttpClient: undefined,
  };

  const originalWindow = globalThis.window;
  // @ts-expect-error — intentional delete for SSR branch
  delete globalThis.window;

  try {
    // @ts-expect-error — stand-in only implements queryFn/convexClient
    const queryFn = convexInfiniteQueryFn(convexQueryClient);
    await expect(
      queryFn({
        client: new QueryClient(),
        direction: "forward",
        meta: undefined,
        pageParam: { cursor: null, numItems: 20 },
        queryKey: [CONVEX_INFINITE_QUERY_KEY, "admin:listBabies", { hideDemo: true }],
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("Convex SSR HTTP client is not available");
  } finally {
    globalThis.window = originalWindow;
  }
});
