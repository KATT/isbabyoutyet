import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { anyApi, makeFunctionReference } from "convex/server";
import * as React from "react";
import { expect, test, vi } from "vitest";

type WatchHandle = {
  onUpdate: (cb: () => void) => () => void;
  localQueryResult: () =>
    | { page: { id: string }[]; isDone: boolean; continueCursor: string }
    | undefined;
};

const mocks = vi.hoisted(() => {
  const localResult = { page: [{ id: "a" }], isDone: true, continueCursor: "" };
  const onUpdate = vi.fn<(cb: () => void) => () => void>((_cb) => {
    return () => undefined;
  });
  const watchQuery = vi.fn<() => WatchHandle>(() => ({
    onUpdate,
    localQueryResult: () => localResult,
  }));
  // Stable client identity — a fresh object per useConvex() call would itself
  // force the live-pages effect to resubscribe.
  const convexClient = { watchQuery };
  return { localResult, onUpdate, watchQuery, convexClient };
});

vi.mock("convex/react", () => ({
  useConvex: () => mocks.convexClient,
}));

const { useLiveConvexInfinitePages } = await import("./useLiveConvexInfinitePages");

function wrapperFor(client: QueryClient) {
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, props.children);
  };
}

test("useLiveConvexInfinitePages watches each loaded page and patches the cache", () => {
  const client = new QueryClient();
  const setSpy = vi.spyOn(client, "setQueryData");
  const queryKey = ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }] as const;
  const funcRef = makeFunctionReference("timeline:listByBaby");
  const updateCbs: Array<() => void> = [];

  mocks.watchQuery.mockClear();
  mocks.watchQuery.mockImplementation(() => ({
    onUpdate: (cb: () => void) => {
      updateCbs.push(cb);
      return () => undefined;
    },
    localQueryResult: () => mocks.localResult,
  }));

  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        queryKey,
        funcRef: funcRef as never,
        args: { babyId: "b1" },
        pageParams: [
          { numItems: 20, cursor: null },
          { numItems: 20, cursor: "c1" },
        ],
      }),
    { wrapper: wrapperFor(client) },
  );

  expect(mocks.watchQuery).toHaveBeenCalledTimes(2);
  expect(mocks.watchQuery).toHaveBeenCalledWith(funcRef, {
    babyId: "b1",
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(mocks.watchQuery).toHaveBeenCalledWith(funcRef, {
    babyId: "b1",
    paginationOpts: { numItems: 20, cursor: "c1" },
  });

  client.setQueryData(queryKey, {
    pages: [
      { page: [], isDone: false, continueCursor: "c1" },
      { page: [], isDone: true, continueCursor: "" },
    ],
    pageParams: [
      { numItems: 20, cursor: null },
      { numItems: 20, cursor: "c1" },
    ],
  });
  setSpy.mockClear();

  updateCbs[1]?.();
  expect(setSpy).toHaveBeenCalled();
  const updater = setSpy.mock.calls[0]?.[1];
  expect(updater).toBeTypeOf("function");
  const next = (
    updater as (previous: {
      pages: unknown[];
      pageParams: unknown[];
    }) => { pages: unknown[] } | undefined
  )({
    pages: [
      { page: [], isDone: false, continueCursor: "c1" },
      { page: [], isDone: true, continueCursor: "" },
    ],
    pageParams: [
      { numItems: 20, cursor: null },
      { numItems: 20, cursor: "c1" },
    ],
  });
  expect(next?.pages[1]).toEqual(mocks.localResult);

  unmount();
});

test("useLiveConvexInfinitePages skips updates when localQueryResult throws or is undefined", () => {
  const client = new QueryClient();
  const setSpy = vi.spyOn(client, "setQueryData");
  const queryKey = ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }] as const;

  let call = 0;
  mocks.watchQuery.mockImplementation(() => {
    call += 1;
    return {
      onUpdate: (cb: () => void) => {
        cb();
        return () => undefined;
      },
      localQueryResult: () => {
        if (call === 1) {
          throw new Error("not ready");
        }
        return undefined;
      },
    };
  });

  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        queryKey,
        funcRef: makeFunctionReference("timeline:listByBaby") as never,
        args: { babyId: "b1" },
        pageParams: [
          { numItems: 20, cursor: null },
          { numItems: 20, cursor: "c1" },
        ],
      }),
    { wrapper: wrapperFor(client) },
  );

  expect(setSpy).not.toHaveBeenCalled();
  unmount();
});

test("useLiveConvexInfinitePages leaves cache alone when previous data is missing", () => {
  const client = new QueryClient();
  const setSpy = vi.spyOn(client, "setQueryData");
  const queryKey = ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }] as const;
  let updateCb: (() => void) | null = null;

  mocks.watchQuery.mockImplementation(() => ({
    onUpdate: (cb: () => void) => {
      updateCb = cb;
      return () => undefined;
    },
    localQueryResult: () => mocks.localResult,
  }));

  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        queryKey,
        funcRef: makeFunctionReference("timeline:listByBaby") as never,
        args: { babyId: "b1" },
        pageParams: [{ numItems: 20, cursor: null }],
      }),
    { wrapper: wrapperFor(client) },
  );

  setSpy.mockClear();
  expect(updateCb).not.toBeNull();
  updateCb!();
  expect(setSpy).toHaveBeenCalled();
  const updater = setSpy.mock.calls[0]?.[1];
  expect(updater).toBeTypeOf("function");
  expect((updater as (previous: undefined) => undefined)(undefined)).toBeUndefined();

  unmount();
});

test("useLiveConvexInfinitePages is a no-op when there are no pageParams", () => {
  const client = new QueryClient();
  mocks.watchQuery.mockClear();
  mocks.watchQuery.mockImplementation(() => ({
    onUpdate: mocks.onUpdate,
    localQueryResult: () => mocks.localResult,
  }));

  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        queryKey: ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }],
        funcRef: makeFunctionReference("timeline:listByBaby") as never,
        args: { babyId: "b1" },
        pageParams: [],
      }),
    { wrapper: wrapperFor(client) },
  );

  expect(mocks.watchQuery).not.toHaveBeenCalled();
  unmount();
});

test("useLiveConvexInfinitePages does not resubscribe when opts identities change with same contents", () => {
  const client = new QueryClient();
  const unsubscribers: Array<ReturnType<typeof vi.fn>> = [];

  mocks.watchQuery.mockClear();
  mocks.watchQuery.mockImplementation(() => ({
    onUpdate: () => {
      const unsubscribe = vi.fn();
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    },
    localQueryResult: () => mocks.localResult,
  }));

  const { rerender, unmount } = renderHook(
    (props: {
      queryKey: readonly unknown[];
      args: Record<string, unknown>;
      pageParams: { numItems: number; cursor: string | null }[];
    }) =>
      useLiveConvexInfinitePages({
        queryKey: props.queryKey as never,
        // Fresh api-proxy identity each render, same function name.
        funcRef: anyApi.timeline.listByBaby as never,
        args: props.args,
        pageParams: props.pageParams,
      }),
    {
      wrapper: wrapperFor(client),
      initialProps: {
        queryKey: ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }],
        args: { babyId: "b1" },
        pageParams: [{ numItems: 20, cursor: null }],
      },
    },
  );

  expect(mocks.watchQuery).toHaveBeenCalledTimes(1);
  expect(unsubscribers).toHaveLength(1);

  rerender({
    queryKey: ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }],
    args: { babyId: "b1" },
    pageParams: [{ numItems: 20, cursor: null }],
  });

  expect(mocks.watchQuery).toHaveBeenCalledTimes(1);
  expect(unsubscribers[0]).not.toHaveBeenCalled();

  unmount();
  expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
});

test("useLiveConvexInfinitePages resubscribes when args contents change", () => {
  const client = new QueryClient();
  const unsubscribers: Array<ReturnType<typeof vi.fn>> = [];

  mocks.watchQuery.mockClear();
  mocks.watchQuery.mockImplementation(() => ({
    onUpdate: () => {
      const unsubscribe = vi.fn();
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    },
    localQueryResult: () => mocks.localResult,
  }));

  const { rerender, unmount } = renderHook(
    (props: { args: Record<string, unknown> }) =>
      useLiveConvexInfinitePages({
        queryKey: ["convexInfiniteQuery", "timeline:listByBaby", props.args] as never,
        funcRef: anyApi.timeline.listByBaby as never,
        args: props.args,
        pageParams: [{ numItems: 20, cursor: null }],
      }),
    {
      wrapper: wrapperFor(client),
      initialProps: { args: { babyId: "b1" } as Record<string, unknown> },
    },
  );

  expect(mocks.watchQuery).toHaveBeenCalledTimes(1);

  rerender({ args: { babyId: "b1", visitorId: "v1" } as Record<string, unknown> });

  expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
  expect(mocks.watchQuery).toHaveBeenCalledTimes(2);
  expect(mocks.watchQuery).toHaveBeenLastCalledWith(makeFunctionReference("timeline:listByBaby"), {
    babyId: "b1",
    visitorId: "v1",
    paginationOpts: { numItems: 20, cursor: null },
  });

  unmount();
});

test("useLiveConvexInfinitePages ignores late updates past the cached page count", () => {
  const client = new QueryClient();
  const setSpy = vi.spyOn(client, "setQueryData");
  let updateCb: (() => void) | null = null;

  mocks.watchQuery.mockImplementation(() => ({
    onUpdate: (cb: () => void) => {
      updateCb = cb;
      return () => undefined;
    },
    localQueryResult: () => mocks.localResult,
  }));

  const queryKey = ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }] as const;
  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        queryKey,
        funcRef: makeFunctionReference("timeline:listByBaby") as never,
        args: { babyId: "b1" },
        pageParams: [
          { numItems: 20, cursor: null },
          { numItems: 20, cursor: "c1" },
        ],
      }),
    { wrapper: wrapperFor(client) },
  );

  setSpy.mockClear();
  updateCb!();
  const updater = setSpy.mock.calls[0]?.[1] as (previous: {
    pages: unknown[];
    pageParams: unknown[];
  }) => { pages: unknown[] };
  const previous = {
    pages: [{ page: [], isDone: false, continueCursor: "c1" }],
    pageParams: [{ numItems: 20, cursor: null }],
  };
  expect(updater(previous)).toBe(previous);

  unmount();
});
