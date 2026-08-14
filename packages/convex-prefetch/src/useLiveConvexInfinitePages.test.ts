import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
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
  let updateCb: (() => void) | null = null;
  const onUpdate = vi.fn<(cb: () => void) => () => void>((cb) => {
    updateCb = cb;
    return () => undefined;
  });
  const watchQuery = vi.fn<() => WatchHandle>(() => ({
    onUpdate,
    localQueryResult: () => localResult,
  }));
  return { localResult, onUpdate, watchQuery, getUpdateCb: () => updateCb };
});

vi.mock("convex/react", () => ({
  useConvex: () => ({ watchQuery: mocks.watchQuery }),
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

  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        queryKey,
        funcRef: "timeline:listByBaby" as never,
        args: { babyId: "b1" },
        pageParams: [
          { numItems: 20, cursor: null },
          { numItems: 20, cursor: "c1" },
        ],
      }),
    { wrapper: wrapperFor(client) },
  );

  expect(mocks.watchQuery).toHaveBeenCalledTimes(2);
  expect(mocks.watchQuery).toHaveBeenCalledWith("timeline:listByBaby", {
    babyId: "b1",
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(mocks.watchQuery).toHaveBeenCalledWith("timeline:listByBaby", {
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

  mocks.getUpdateCb()?.();
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
        funcRef: "timeline:listByBaby" as never,
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
        funcRef: "timeline:listByBaby" as never,
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
        funcRef: "timeline:listByBaby" as never,
        args: { babyId: "b1" },
        pageParams: [],
      }),
    { wrapper: wrapperFor(client) },
  );

  expect(mocks.watchQuery).not.toHaveBeenCalled();
  unmount();
});
