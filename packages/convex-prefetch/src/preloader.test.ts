import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { FunctionReference, PaginationResult } from "convex/server";
import * as React from "react";
import { expect, test, vi } from "vitest";
import { getConvexQueryPreloader } from "./preloader";
import { registerConvexInfiniteQueryClient } from "./convexInfiniteQuery";
import {
  preloadedConvexQueryOptions,
  useInitiateConvexQuery,
  usePreloadedConvexQuery,
} from "./usePreloadedConvexQuery";
import { testPreloadedConvexQuery } from "./test-helpers";

type Profile = { locale: string; isAdmin: boolean };
type ProfileGetRef = FunctionReference<"query", "public", Record<string, never>, Profile>;
const profileGet = "profile:get" as unknown as ProfileGetRef;

type BabyByIdRef = FunctionReference<"query", "public", { id: string }, { name: string }>;
const babyByPublicId = "baby:getByPublicId" as unknown as BabyByIdRef;

type IsSubscribedRef = FunctionReference<
  "query",
  "public",
  { babyId: string; endpoint: string },
  boolean
>;
const pushIsSubscribed = "pushSubscriptions:isSubscribed" as unknown as IsSubscribedRef;

type TestInfinitePage = PaginationResult<string>;

function createWrapper(queryClient: QueryClient) {
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

test("getConvexQueryPreloader awaits queries and returns handles with initialData", async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async () => ({ locale: "sv", isAdmin: false }),
      },
    },
  });

  const preloader = getConvexQueryPreloader(queryClient);
  const handle = await preloader.ensureQueryData(profileGet, {});

  expect(handle.input).toEqual({});
  expect(handle.initialData).toEqual({ locale: "sv", isAdmin: false });
});

test("fetchQueryData replaces cached data with a fresh snapshot", async () => {
  const queryFn = vi.fn<() => Promise<{ name: string }>>(async () => ({ name: "Fresh baby" }));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn } },
  });
  const queryKey = ["convexQuery", "baby:getByPublicId", { id: "baby-smith" }];
  queryClient.setQueryData(queryKey, { name: "Cached baby" });

  const preloader = getConvexQueryPreloader(queryClient);
  const handle = await preloader.fetchQueryData(babyByPublicId, { id: "baby-smith" });

  expect(queryFn).toHaveBeenCalledOnce();
  expect(handle.input).toEqual({ id: "baby-smith" });
  expect(handle.initialData).toEqual({ name: "Fresh baby" });
});

test("getConvexQueryPreloader ensures infinite pages and stores numItems", async () => {
  registerConvexInfiniteQueryClient({
    convexClient: {
      query: vi.fn<() => Promise<TestInfinitePage>>(async () => ({
        page: ["row"],
        isDone: true,
        continueCursor: "",
      })),
    },
    serverHttpClient: undefined,
  } as never);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const preloader = getConvexQueryPreloader(queryClient);
  const handle = await preloader.ensureInfiniteQueryData("admin:listBabies" as never, {
    args: { hideDemo: true } as never,
    numItems: 20,
  });

  expect(handle.input).toEqual({ hideDemo: true });
  expect(handle.numItems).toBe(20);
  expect(handle.initialData.pages[0]).toEqual({
    page: ["row"],
    isDone: true,
    continueCursor: "",
  });
});

test("initiateQueryData starts the fetch without awaiting and returns a data-less handle", async () => {
  const queryFn = vi.fn<() => Promise<Profile>>(async () => ({ locale: "sv", isAdmin: false }));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn } },
  });

  const preloader = getConvexQueryPreloader(queryClient);
  const handle = preloader.initiateQueryData(profileGet, {});

  expect(handle.input).toEqual({});
  expect("initialData" in handle).toBe(false);
  await waitFor(() => {
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});

test("initiateInfiniteQueryData starts the first page without awaiting", async () => {
  const convexClientQuery = vi.fn<() => Promise<TestInfinitePage>>(async () => ({
    page: ["row"],
    isDone: true,
    continueCursor: "",
  }));
  registerConvexInfiniteQueryClient({
    convexClient: { query: convexClientQuery },
    serverHttpClient: undefined,
  } as never);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const preloader = getConvexQueryPreloader(queryClient);
  const handle = preloader.initiateInfiniteQueryData("admin:listBabies" as never, {
    args: { hideDemo: true } as never,
    numItems: 20,
  });

  expect(handle.input).toEqual({ hideDemo: true });
  expect(handle.numItems).toBe(20);
  expect("initialData" in handle).toBe(false);
  await waitFor(() => {
    expect(convexClientQuery).toHaveBeenCalledTimes(1);
  });
});

test("preloadedConvexQueryOptions carries initialData only for preloaded handles", () => {
  const preloaded = testPreloadedConvexQuery<BabyByIdRef>({
    input: { id: "b1" },
    initialData: { name: "Avery" },
  });

  const withData = preloadedConvexQueryOptions(babyByPublicId, preloaded);
  expect("initialData" in withData && withData.initialData).toEqual({ name: "Avery" });

  const withoutData = preloadedConvexQueryOptions(babyByPublicId, { input: { id: "b1" } });
  expect("initialData" in withoutData).toBe(false);
});

test("usePreloadedConvexQuery suspends on the handle's query", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const handle = testPreloadedConvexQuery<ProfileGetRef>({
    input: {},
    initialData: { locale: "sv", isAdmin: false },
  });

  const { result } = renderHook(() => usePreloadedConvexQuery(profileGet, handle), {
    wrapper: createWrapper(queryClient),
  });

  await waitFor(() => {
    expect(result.current.data).toEqual({ locale: "sv", isAdmin: false });
  });
});

test("useInitiateConvexQuery starts the fetch and returns an initiated handle", async () => {
  const queryFn = vi.fn<() => Promise<boolean>>(async () => true);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn } },
  });

  const { result } = renderHook(
    () =>
      useInitiateConvexQuery(pushIsSubscribed, {
        babyId: "b1",
        endpoint: "https://push.example",
      }),
    { wrapper: createWrapper(queryClient) },
  );

  expect(result.current.input).toEqual({ babyId: "b1", endpoint: "https://push.example" });
  await waitFor(() => {
    expect(queryFn).toHaveBeenCalled();
  });
});
