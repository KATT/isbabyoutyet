import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { FunctionReference } from "convex/server";
import * as React from "react";
import { expect, test, vi } from "vitest";
import { getConvexQueryPreloader } from "./preloader";
import { registerConvexInfiniteQueryClient } from "./convexInfiniteQuery";
import { preloadedConvexQueryOptions, usePreloadedConvexQuery } from "./usePreloadedConvexQuery";
import { testPreloadedConvexQuery } from "./test-helpers";

type Profile = { locale: string; isAdmin: boolean };
type ProfileGetRef = FunctionReference<"query", "public", Record<string, never>, Profile>;
const profileGet = "profile:get" as unknown as ProfileGetRef;

type BabyByIdRef = FunctionReference<"query", "public", { id: string }, { name: string }>;
const babyByPublicId = "baby:getByPublicId" as unknown as BabyByIdRef;

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

test("getConvexQueryPreloader ensures infinite pages and stores numItems", async () => {
  registerConvexInfiniteQueryClient({
    convexClient: {
      query: vi.fn<() => Promise<unknown>>(async () => ({
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

test("preloadedConvexQueryOptions rebuilds the query options with initialData", () => {
  const preloaded = testPreloadedConvexQuery<BabyByIdRef>({
    input: { id: "b1" },
    initialData: { name: "Avery" },
  });

  const options = preloadedConvexQueryOptions(babyByPublicId, preloaded);
  expect(options.initialData).toEqual({ name: "Avery" });
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
