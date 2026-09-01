import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import {
  makeFunctionReference,
  type DefaultFunctionArgs,
  type FunctionReference,
} from "convex/server";
import * as React from "react";
import { expect, test, vi } from "vitest";

import { useLiveConvexInfinitePages } from "./useLiveConvexInfinitePages";

type LivePage = { page: { id: string }[]; isDone: boolean; continueCursor: string };

type WatchHandle = {
  onUpdate: (cb: () => void) => () => void;
  localQueryResult: () => LivePage | undefined;
};

type WatchQuery = (funcRef: FunctionReference<"query">, args: DefaultFunctionArgs) => WatchHandle;
type LivePagesHookProps = { args: DefaultFunctionArgs };

const localResult: LivePage = { page: [{ id: "a" }], isDone: true, continueCursor: "" };

/**
 * `useConvex()` only reads context, so the real `ConvexProvider` happily
 * carries a `watchQuery`-shaped stand-in. The stub client is built once per
 * wrapper: a fresh identity per render would itself force the live-pages
 * effect to resubscribe.
 */
function wrapperFor(client: QueryClient, watchQuery: WatchQuery) {
  // @ts-expect-error — stand-in only implements watchQuery
  const convex: ConvexReactClient = { watchQuery };
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(
      ConvexProvider,
      { client: convex },
      React.createElement(QueryClientProvider, { client }, props.children),
    );
  };
}

test("useLiveConvexInfinitePages watches each loaded page and patches the cache", () => {
  const client = new QueryClient();
  const setSpy = vi.spyOn(client, "setQueryData");
  const queryKey = ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }] as const;
  const funcRef = makeFunctionReference<"query">("timeline:listByBaby");
  const updateCbs: Array<() => void> = [];

  const watchQuery = vi.fn<WatchQuery>(() => ({
    onUpdate: (cb: () => void) => {
      updateCbs.push(cb);
      return () => undefined;
    },
    localQueryResult: () => localResult,
  }));

  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        queryKey,
        funcRef,
        args: { babyId: "b1" },
        pageParams: [
          { numItems: 20, cursor: null },
          { numItems: 20, cursor: "c1" },
        ],
      }),
    { wrapper: wrapperFor(client, watchQuery) },
  );

  expect(watchQuery).toHaveBeenCalledTimes(2);
  expect(watchQuery).toHaveBeenCalledWith(funcRef, {
    babyId: "b1",
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(watchQuery).toHaveBeenCalledWith(funcRef, {
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
  const next = // SAFETY: setQueryData spy records the updater this test invokes.
    (
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
  expect(next?.pages[1]).toEqual(localResult);

  unmount();
});

test("useLiveConvexInfinitePages skips updates when localQueryResult throws or is undefined", () => {
  const client = new QueryClient();
  const setSpy = vi.spyOn(client, "setQueryData");
  const queryKey = ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }] as const;

  let call = 0;
  const watchQuery = vi.fn<WatchQuery>(() => {
    call += 1;
    const throwsOnRead = call === 1;
    return {
      onUpdate: (cb: () => void) => {
        cb();
        return () => undefined;
      },
      localQueryResult: () => {
        if (throwsOnRead) {
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
        funcRef: makeFunctionReference("timeline:listByBaby"),
        args: { babyId: "b1" },
        pageParams: [
          { numItems: 20, cursor: null },
          { numItems: 20, cursor: "c1" },
        ],
      }),
    { wrapper: wrapperFor(client, watchQuery) },
  );

  expect(setSpy).not.toHaveBeenCalled();
  unmount();
});

test("useLiveConvexInfinitePages leaves cache alone when previous data is missing", () => {
  const client = new QueryClient();
  const setSpy = vi.spyOn(client, "setQueryData");
  const queryKey = ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }] as const;
  let updateCb: (() => void) | null = null;

  const watchQuery = vi.fn<WatchQuery>(() => ({
    onUpdate: (cb: () => void) => {
      updateCb = cb;
      return () => undefined;
    },
    localQueryResult: () => localResult,
  }));

  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        queryKey,
        funcRef: makeFunctionReference("timeline:listByBaby"),
        args: { babyId: "b1" },
        pageParams: [{ numItems: 20, cursor: null }],
      }),
    { wrapper: wrapperFor(client, watchQuery) },
  );

  setSpy.mockClear();
  expect(updateCb).not.toBeNull();
  updateCb!();
  expect(setSpy).toHaveBeenCalled();
  const updater = setSpy.mock.calls[0]?.[1];
  expect(updater).toBeTypeOf("function");
  // SAFETY: setQueryData spy records the updater this test invokes.
  expect((updater as (previous: undefined) => undefined)(undefined)).toBeUndefined();

  unmount();
});

test("useLiveConvexInfinitePages is a no-op when there are no pageParams", () => {
  const client = new QueryClient();
  const watchQuery = vi.fn<WatchQuery>(() => ({
    onUpdate: () => () => undefined,
    localQueryResult: () => localResult,
  }));

  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        queryKey: ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }],
        funcRef: makeFunctionReference("timeline:listByBaby"),
        args: { babyId: "b1" },
        pageParams: [],
      }),
    { wrapper: wrapperFor(client, watchQuery) },
  );

  expect(watchQuery).not.toHaveBeenCalled();
  unmount();
});

test("useLiveConvexInfinitePages does not resubscribe when opts identities change with same contents", () => {
  const client = new QueryClient();
  const unsubscribers: Array<ReturnType<typeof vi.fn>> = [];

  const watchQuery = vi.fn<WatchQuery>(() => ({
    onUpdate: () => {
      const unsubscribe = vi.fn();
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    },
    localQueryResult: () => localResult,
  }));

  const { rerender, unmount } = renderHook(
    (props: {
      queryKey: readonly unknown[];
      args: DefaultFunctionArgs;
      pageParams: { numItems: number; cursor: string | null }[];
    }) =>
      useLiveConvexInfinitePages({
        queryKey: props.queryKey,
        // Fresh function-reference identity each render, same function name.
        funcRef: makeFunctionReference<"query">("timeline:listByBaby"),
        args: props.args,
        pageParams: props.pageParams,
      }),
    {
      wrapper: wrapperFor(client, watchQuery),
      initialProps: {
        queryKey: ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1", tag: "x" }],
        args: { babyId: "b1", tag: "x" },
        pageParams: [{ numItems: 20, cursor: null }],
      },
    },
  );

  expect(watchQuery).toHaveBeenCalledTimes(1);
  expect(unsubscribers).toHaveLength(1);

  rerender({
    queryKey: ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1", tag: "x" }],
    args: { babyId: "b1", tag: "x" },
    pageParams: [{ numItems: 20, cursor: null }],
  });

  expect(watchQuery).toHaveBeenCalledTimes(1);
  expect(unsubscribers[0]).not.toHaveBeenCalled();

  // Object key insertion order must not force a resubscribe.
  rerender({
    queryKey: ["convexInfiniteQuery", "timeline:listByBaby", { tag: "x", babyId: "b1" }],
    args: { tag: "x", babyId: "b1" },
    pageParams: [{ cursor: null, numItems: 20 }],
  });

  expect(watchQuery).toHaveBeenCalledTimes(1);
  expect(unsubscribers[0]).not.toHaveBeenCalled();

  unmount();
  expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
});

test("useLiveConvexInfinitePages resubscribes when args contents change", () => {
  const client = new QueryClient();
  const unsubscribers: Array<ReturnType<typeof vi.fn>> = [];

  const watchQuery = vi.fn<WatchQuery>(() => ({
    onUpdate: () => {
      const unsubscribe = vi.fn();
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    },
    localQueryResult: () => localResult,
  }));

  const initialProps: LivePagesHookProps = { args: { babyId: "b1" } };
  const { rerender, unmount } = renderHook(
    (props: LivePagesHookProps) =>
      useLiveConvexInfinitePages({
        queryKey: ["convexInfiniteQuery", "timeline:listByBaby", props.args],
        funcRef: makeFunctionReference<"query">("timeline:listByBaby"),
        args: props.args,
        pageParams: [{ numItems: 20, cursor: null }],
      }),
    {
      wrapper: wrapperFor(client, watchQuery),
      initialProps,
    },
  );

  expect(watchQuery).toHaveBeenCalledTimes(1);

  const nextArgs: DefaultFunctionArgs = { babyId: "b1", visitorId: "v1" };
  rerender({ args: nextArgs });

  expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
  expect(watchQuery).toHaveBeenCalledTimes(2);
  expect(watchQuery).toHaveBeenLastCalledWith(makeFunctionReference("timeline:listByBaby"), {
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

  const watchQuery = vi.fn<WatchQuery>(() => ({
    onUpdate: (cb: () => void) => {
      updateCb = cb;
      return () => undefined;
    },
    localQueryResult: () => localResult,
  }));

  const queryKey = ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }] as const;
  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        queryKey,
        funcRef: makeFunctionReference("timeline:listByBaby"),
        args: { babyId: "b1" },
        pageParams: [
          { numItems: 20, cursor: null },
          { numItems: 20, cursor: "c1" },
        ],
      }),
    { wrapper: wrapperFor(client, watchQuery) },
  );

  setSpy.mockClear();
  updateCb!();
  // SAFETY: Test fixture is a subset of the production type.
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
