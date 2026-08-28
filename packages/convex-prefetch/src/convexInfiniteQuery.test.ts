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
  const options = convexInfiniteQuery("timeline:listByBaby" as never, {
    args: { babyId: "baby-1" },
    initialNumItems: 20,
  });

  expect(options.queryKey[0]).toBe(CONVEX_INFINITE_QUERY_KEY);
  expect(options.initialPageParam).toEqual({ numItems: 20, cursor: null });
  expect(
    options.getNextPageParam(
      { page: [], isDone: false, continueCursor: "c1" },
      [],
      { numItems: 20, cursor: null },
      [],
    ),
  ).toEqual({ numItems: 20, cursor: "c1" });
  expect(
    options.getNextPageParam(
      { page: [], isDone: true, continueCursor: "c1" },
      [],
      { numItems: 20, cursor: null },
      [],
    ),
  ).toBeUndefined();
});

test("convexInfiniteQuery queryFn uses the registered Convex client", async () => {
  const query = vi.fn<() => Promise<{ page: unknown[]; isDone: boolean; continueCursor: string }>>(
    async () => ({ page: ["row"], isDone: true, continueCursor: "" }),
  );
  registerConvexInfiniteQueryClient({
    convexClient: { query },
    serverHttpClient: undefined,
  } as never);

  const options = convexInfiniteQuery("admin:listBabies" as never, {
    args: { hideDemo: true },
    initialNumItems: 20,
  });
  const page = await options.queryFn!({
    queryKey: options.queryKey,
    pageParam: options.initialPageParam,
    meta: undefined,
    signal: new AbortController().signal,
    client: new QueryClient(),
    direction: "forward",
  });

  expect(query).toHaveBeenCalledWith("admin:listBabies", {
    hideDemo: true,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(page).toEqual({ page: ["row"], isDone: true, continueCursor: "" });
});

test("convexInfiniteQueryFn merges pageParam into paginationOpts", async () => {
  const query = vi.fn<() => Promise<{ page: unknown[]; isDone: boolean; continueCursor: string }>>(
    async () => ({ page: [], isDone: true, continueCursor: "" }),
  );
  const convexQueryClient = {
    queryFn: () => async () => {
      throw new Error("fallback should not run");
    },
    convexClient: { query },
    serverHttpClient: undefined,
  };

  const queryFn = convexInfiniteQueryFn(convexQueryClient as never);
  const result = await queryFn({
    queryKey: [CONVEX_INFINITE_QUERY_KEY, "admin:listBabies", { hideDemo: true }],
    pageParam: { numItems: 20, cursor: null },
    meta: undefined,
    signal: new AbortController().signal,
    client: new QueryClient(),
    direction: "forward",
  } as never);

  expect(query).toHaveBeenCalledWith("admin:listBabies", {
    hideDemo: true,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(result).toEqual({ page: [], isDone: true, continueCursor: "" });
});

test("convexInfiniteQueryFn falls back for non-infinite keys", async () => {
  const fallback = vi.fn<() => Promise<string>>(async () => "ok");
  const convexQueryClient = {
    queryFn: () => fallback,
    convexClient: { query: vi.fn<() => Promise<TestInfinitePage>>() },
    serverHttpClient: undefined,
  };

  const queryFn = convexInfiniteQueryFn(convexQueryClient as never);
  const result = await queryFn({
    queryKey: ["convexQuery", "profile:get", {}],
    pageParam: undefined,
    meta: undefined,
    signal: new AbortController().signal,
    client: new QueryClient(),
  } as never);

  expect(fallback).toHaveBeenCalled();
  expect(result).toBe("ok");
});

test("convexInfiniteQuery queryFn rejects when the client was never registered", async () => {
  registerConvexInfiniteQueryClient(null as never);
  const options = convexInfiniteQuery("admin:listBabies" as never, {
    args: { hideDemo: true },
    initialNumItems: 20,
  });

  await expect(
    options.queryFn!({
      queryKey: options.queryKey,
      pageParam: options.initialPageParam,
      meta: undefined,
      signal: new AbortController().signal,
      client: new QueryClient(),
      direction: "forward",
    }),
  ).rejects.toThrow("registerConvexInfiniteQueryClient() was not called");
});

test("convexInfiniteQueryFn rejects without a pageParam", async () => {
  const convexQueryClient = {
    queryFn: () => async () => "unused",
    convexClient: { query: vi.fn<() => Promise<TestInfinitePage>>() },
    serverHttpClient: undefined,
  };
  const queryFn = convexInfiniteQueryFn(convexQueryClient as never);

  await expect(
    queryFn({
      queryKey: [CONVEX_INFINITE_QUERY_KEY, "admin:listBabies", { hideDemo: true }],
      pageParam: undefined,
      meta: undefined,
      signal: new AbortController().signal,
      client: new QueryClient(),
      direction: "forward",
    } as never),
  ).rejects.toThrow("Convex infinite query requires an initialPageParam");
});

test("convexInfiniteQueryFn uses the SSR HTTP client when window is undefined", async () => {
  const consistentQuery = vi.fn<
    () => Promise<{ page: unknown[]; isDone: boolean; continueCursor: string }>
  >(async () => ({ page: ["ssr"], isDone: true, continueCursor: "" }));
  const convexQueryClient = {
    queryFn: () => async () => {
      throw new Error("fallback should not run");
    },
    convexClient: { query: vi.fn<() => Promise<TestInfinitePage>>() },
    serverHttpClient: { consistentQuery },
  };

  const originalWindow = globalThis.window;
  // Simulate SSR: drop `window` for this fetch.
  // @ts-expect-error — intentional delete for SSR branch
  delete globalThis.window;

  try {
    const queryFn = convexInfiniteQueryFn(convexQueryClient as never);
    const result = await queryFn({
      queryKey: [CONVEX_INFINITE_QUERY_KEY, "admin:listBabies", { hideDemo: true }],
      pageParam: { numItems: 20, cursor: null },
      meta: undefined,
      signal: new AbortController().signal,
      client: new QueryClient(),
      direction: "forward",
    } as never);

    expect(consistentQuery).toHaveBeenCalledWith("admin:listBabies", {
      hideDemo: true,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(result).toEqual({ page: ["ssr"], isDone: true, continueCursor: "" });
  } finally {
    globalThis.window = originalWindow;
  }
});

test("convexInfiniteQueryFn rejects on SSR when the HTTP client is missing", async () => {
  const convexQueryClient = {
    queryFn: () => async () => "unused",
    convexClient: { query: vi.fn<() => Promise<TestInfinitePage>>() },
    serverHttpClient: undefined,
  };

  const originalWindow = globalThis.window;
  // @ts-expect-error — intentional delete for SSR branch
  delete globalThis.window;

  try {
    const queryFn = convexInfiniteQueryFn(convexQueryClient as never);
    await expect(
      queryFn({
        queryKey: [CONVEX_INFINITE_QUERY_KEY, "admin:listBabies", { hideDemo: true }],
        pageParam: { numItems: 20, cursor: null },
        meta: undefined,
        signal: new AbortController().signal,
        client: new QueryClient(),
        direction: "forward",
      } as never),
    ).rejects.toThrow("Convex SSR HTTP client is not available");
  } finally {
    globalThis.window = originalWindow;
  }
});
