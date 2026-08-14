import { infiniteQueryOptions, QueryClient, queryOptions } from "@tanstack/react-query";
import { expect, test } from "vitest";
import {
  getQueryPreloader,
  preloadedInfiniteQueryOptions,
  preloadedQueryOptions,
} from "./index.js";
import { testPreloadedInfiniteQuery, testPreloadedQuery } from "./test-helpers.js";

const postById = (input: { postId: string }) =>
  queryOptions({
    queryKey: ["posts", "byId", input] as const,
    queryFn: async () => ({ id: input.postId, title: `Post ${input.postId}` }),
  });

const postsInfinite = (input: { tag: string }) =>
  infiniteQueryOptions({
    queryKey: ["posts", "infinite", input] as const,
    queryFn: async () => ({
      page: [{ id: "1", tag: input.tag }],
      nextCursor: null as string | null,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: () => null,
  });

const accountSettings = () =>
  queryOptions({
    queryKey: ["account", "settings"] as const,
    queryFn: async () => ({ theme: "dark" as const }),
  });

test("getQueryPreloader awaits data and returns a preloaded handle with initialData", async () => {
  const queryClient = new QueryClient();
  const preloader = getQueryPreloader(queryClient);

  const handle = await preloader.ensureQueryData(postById, { postId: "2" });
  expect(handle.input).toEqual({ postId: "2" });
  expect(handle.initialData).toEqual({ id: "2", title: "Post 2" });

  const options = preloadedQueryOptions(postById, handle);
  expect(options.initialData).toEqual(handle.initialData);
});

test("getQueryPreloader awaits infinite query data", async () => {
  const queryClient = new QueryClient();
  const preloader = getQueryPreloader(queryClient);
  const handle = await preloader.ensureInfiniteQueryData(postsInfinite, { tag: "hot" });
  expect(handle.initialData.pages[0]?.page[0]?.tag).toBe("hot");

  const options = preloadedInfiniteQueryOptions(postsInfinite, handle);
  expect(options.initialData).toEqual(handle.initialData);
});

test("getQueryPreloader supports no-arg factories", async () => {
  const queryClient = new QueryClient();
  const preloader = getQueryPreloader(queryClient);
  const handle = await preloader.ensureQueryData(accountSettings);

  const options = preloadedQueryOptions(accountSettings, handle);
  const data = await queryClient.ensureQueryData(options);
  expect(data).toEqual({ theme: "dark" });
});

test("preloadedQueryOptions preserves initialData when remixing a preloaded handle", async () => {
  const queryClient = new QueryClient();
  const preloader = getQueryPreloader(queryClient);
  const handle = await preloader.ensureQueryData(postById, { postId: "remix" });
  const options = preloadedQueryOptions(postById, handle, (input) => input);
  expect(options.initialData).toEqual(handle.initialData);
});

test("preloadedInfiniteQueryOptions preserves initialData for preloaded handles", async () => {
  const queryClient = new QueryClient();
  const preloader = getQueryPreloader(queryClient);
  const handle = await preloader.ensureInfiniteQueryData(postsInfinite, { tag: "saved" });
  const options = preloadedInfiniteQueryOptions(postsInfinite, handle);
  expect(options.initialData).toEqual(handle.initialData);
});

test("preloadedInfiniteQueryOptions remixes preloaded infinite handles", async () => {
  const queryClient = new QueryClient();
  const preloader = getQueryPreloader(queryClient);
  const handle = await preloader.ensureInfiniteQueryData(postsInfinite, { tag: "saved" });
  const options = preloadedInfiniteQueryOptions(postsInfinite, handle, (input) => input);
  expect(options.initialData).toEqual(handle.initialData);
});

test("helpers build branded handles for unit tests", () => {
  const preloaded = testPreloadedQuery(postById, { id: "t", title: "Post t" }, { postId: "t" });
  expect(preloaded.input).toEqual({ postId: "t" });
  expect(preloaded.initialData.title).toBe("Post t");

  const preloadedInfinite = testPreloadedInfiniteQuery(
    postsInfinite,
    {
      pages: [{ page: [{ id: "1", tag: "t" }], nextCursor: null }],
      pageParams: [null],
    },
    { tag: "t" },
  );
  expect(preloadedInfinite.initialData.pages[0]?.page[0]?.tag).toBe("t");
});
