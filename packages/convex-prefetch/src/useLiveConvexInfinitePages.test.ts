import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import {
  anyApi,
  makeFunctionReference,
  type DefaultFunctionArgs,
  type FunctionReference,
} from "convex/server";
import { createElement, type ReactNode } from "react";
import { expect, test, vi } from "vitest";

import { useLiveConvexInfinitePages } from "./useLiveConvexInfinitePages";

type LivePage = { continueCursor: string; isDone: boolean; page: Array<{ id: string }> };

type WatchHandle = {
  localQueryResult: () => LivePage | undefined;
  onUpdate: (cb: () => void) => () => void;
};

type WatchQuery = (funcRef: FunctionReference<"query">, args: DefaultFunctionArgs) => WatchHandle;
type LivePagesHookProps = { args: DefaultFunctionArgs };

const localResult: LivePage = { continueCursor: "", isDone: true, page: [{ id: "a" }] };

/**
 * `useConvex()` only reads context, so the real `ConvexProvider` happily
 * carries a `watchQuery`-shaped stand-in. The stub client is built once per
 * wrapper: a fresh identity per render would itself force the live-pages
 * effect to resubscribe.
 */
function wrapperFor(client: QueryClient, watchQuery: WatchQuery) {
  // @ts-expect-error — stand-in only implements watchQuery
  const convex: ConvexReactClient = { watchQuery };
  return function Wrapper(props: { children: ReactNode }) {
    return createElement(
      ConvexProvider,
      { client: convex },
      createElement(QueryClientProvider, { client }, props.children),
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
    localQueryResult: () => localResult,
    onUpdate: (cb: () => void) => {
      updateCbs.push(cb);
      return () => undefined;
    },
  }));

  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        args: { babyId: "b1" },
        funcRef,
        pageParams: [
          { cursor: null, numItems: 20 },
          { cursor: "c1", numItems: 20 },
        ],
        queryKey,
      }),
    { wrapper: wrapperFor(client, watchQuery) },
  );

  expect(watchQuery).toHaveBeenCalledTimes(2);
  expect(watchQuery).toHaveBeenCalledWith(funcRef, {
    babyId: "b1",
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(watchQuery).toHaveBeenCalledWith(funcRef, {
    babyId: "b1",
    paginationOpts: { cursor: "c1", numItems: 20 },
  });

  client.setQueryData(queryKey, {
    pageParams: [
      { cursor: null, numItems: 20 },
      { cursor: "c1", numItems: 20 },
    ],
    pages: [
      { continueCursor: "c1", isDone: false, page: [] },
      { continueCursor: "", isDone: true, page: [] },
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
        pageParams: Array<unknown>;
        pages: Array<unknown>;
      }) => { pages: Array<unknown> } | undefined
    )({
      pageParams: [
        { cursor: null, numItems: 20 },
        { cursor: "c1", numItems: 20 },
      ],
      pages: [
        { continueCursor: "c1", isDone: false, page: [] },
        { continueCursor: "", isDone: true, page: [] },
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
      localQueryResult: () => {
        if (throwsOnRead) {
          throw new Error("not ready");
        }
        return undefined;
      },
      onUpdate: (cb: () => void) => {
        cb();
        return () => undefined;
      },
    };
  });

  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        args: { babyId: "b1" },
        funcRef: makeFunctionReference("timeline:listByBaby"),
        pageParams: [
          { cursor: null, numItems: 20 },
          { cursor: "c1", numItems: 20 },
        ],
        queryKey,
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
    localQueryResult: () => localResult,
    onUpdate: (cb: () => void) => {
      updateCb = cb;
      return () => undefined;
    },
  }));

  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        args: { babyId: "b1" },
        funcRef: makeFunctionReference("timeline:listByBaby"),
        pageParams: [{ cursor: null, numItems: 20 }],
        queryKey,
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
    localQueryResult: () => localResult,
    onUpdate: () => () => undefined,
  }));

  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        args: { babyId: "b1" },
        funcRef: makeFunctionReference("timeline:listByBaby"),
        pageParams: [],
        queryKey: ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }],
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
    localQueryResult: () => localResult,
    onUpdate: () => {
      const unsubscribe = vi.fn();
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    },
  }));

  const { rerender, unmount } = renderHook(
    (props: {
      args: DefaultFunctionArgs;
      pageParams: Array<{ cursor: string | null; numItems: number }>;
      queryKey: ReadonlyArray<unknown>;
    }) =>
      useLiveConvexInfinitePages({
        queryKey: props.queryKey,
        // Fresh api-proxy identity each render, same function name.
        args: props.args,
        funcRef: anyApi.timeline.listByBaby,
        pageParams: props.pageParams,
      }),
    {
      initialProps: {
        args: { babyId: "b1", tag: "x" },
        pageParams: [{ cursor: null, numItems: 20 }],
        queryKey: ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1", tag: "x" }],
      },
      wrapper: wrapperFor(client, watchQuery),
    },
  );

  expect(watchQuery).toHaveBeenCalledTimes(1);
  expect(unsubscribers).toHaveLength(1);

  rerender({
    args: { babyId: "b1", tag: "x" },
    pageParams: [{ cursor: null, numItems: 20 }],
    queryKey: ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1", tag: "x" }],
  });

  expect(watchQuery).toHaveBeenCalledTimes(1);
  expect(unsubscribers[0]).not.toHaveBeenCalled();

  // Object key insertion order must not force a resubscribe.
  rerender({
    args: { babyId: "b1", tag: "x" },
    pageParams: [{ cursor: null, numItems: 20 }],
    queryKey: ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1", tag: "x" }],
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
    localQueryResult: () => localResult,
    onUpdate: () => {
      const unsubscribe = vi.fn();
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    },
  }));

  const initialProps: LivePagesHookProps = { args: { babyId: "b1" } };
  const { rerender, unmount } = renderHook(
    (props: LivePagesHookProps) =>
      useLiveConvexInfinitePages({
        args: props.args,
        funcRef: anyApi.timeline.listByBaby,
        pageParams: [{ cursor: null, numItems: 20 }],
        queryKey: ["convexInfiniteQuery", "timeline:listByBaby", props.args],
      }),
    {
      initialProps,
      wrapper: wrapperFor(client, watchQuery),
    },
  );

  expect(watchQuery).toHaveBeenCalledTimes(1);

  const nextArgs: DefaultFunctionArgs = { babyId: "b1", visitorId: "v1" };
  rerender({ args: nextArgs });

  expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
  expect(watchQuery).toHaveBeenCalledTimes(2);
  expect(watchQuery).toHaveBeenLastCalledWith(makeFunctionReference("timeline:listByBaby"), {
    babyId: "b1",
    paginationOpts: { cursor: null, numItems: 20 },
    visitorId: "v1",
  });

  unmount();
});

test("useLiveConvexInfinitePages ignores late updates past the cached page count", () => {
  const client = new QueryClient();
  const setSpy = vi.spyOn(client, "setQueryData");
  let updateCb: (() => void) | null = null;

  const watchQuery = vi.fn<WatchQuery>(() => ({
    localQueryResult: () => localResult,
    onUpdate: (cb: () => void) => {
      updateCb = cb;
      return () => undefined;
    },
  }));

  const queryKey = ["convexInfiniteQuery", "timeline:listByBaby", { babyId: "b1" }] as const;
  const { unmount } = renderHook(
    () =>
      useLiveConvexInfinitePages({
        args: { babyId: "b1" },
        funcRef: makeFunctionReference("timeline:listByBaby"),
        pageParams: [
          { cursor: null, numItems: 20 },
          { cursor: "c1", numItems: 20 },
        ],
        queryKey,
      }),
    { wrapper: wrapperFor(client, watchQuery) },
  );

  setSpy.mockClear();
  updateCb!();
  // SAFETY: Test fixture is a subset of the production type.
  const updater = setSpy.mock.calls[0]?.[1] as (previous: {
    pageParams: Array<unknown>;
    pages: Array<unknown>;
  }) => { pages: Array<unknown> };
  const previous = {
    pageParams: [{ cursor: null, numItems: 20 }],
    pages: [{ continueCursor: "c1", isDone: false, page: [] }],
  };
  expect(updater(previous)).toBe(previous);

  unmount();
});
