import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { QueryClient } from "@tanstack/react-query";

type RouterOptions = Record<string, unknown>;

const defaultQueryFn = vi.hoisted(() => vi.fn(() => Promise.resolve(null)));
const createRouter = vi.hoisted(() =>
  vi.fn<(options: RouterOptions) => { options: RouterOptions }>((options) => ({ options })),
);

vi.mock("@tanstack/react-router", () => ({
  createRouter,
}));

vi.mock("@tanstack/react-router-ssr-query", () => ({
  setupRouterSsrQueryIntegration: () => {},
}));

vi.mock("@convex-dev/react-query", () => ({
  ConvexQueryClient: class {
    convexClient = {};
    hashFn() {
      return () => "";
    }
    queryFn() {
      return () => Promise.resolve(null);
    }
    connect() {}
  },
}));

vi.mock("convex/react", () => ({
  ConvexProvider: (props: { children: React.ReactNode }) => props.children,
}));

vi.mock("@workspace/convex-prefetch", () => ({
  convexInfiniteQueryFn: () => defaultQueryFn,
  getConvexQueryPreloader: () => ({}),
  registerConvexInfiniteQueryClient: () => {},
}));

vi.mock("./routeTree.gen", () => ({ routeTree: {} }));

vi.mock("./routes/__root", () => ({ RootErrorComponent: () => null }));

vi.mock("@/lib/convex-auth", () => ({ setupClientConvexAuth: () => {} }));

vi.mock("@/lib/i18n", () => ({ getDetectedLocale: () => "en-GB" }));

const { getRouter } = await import("@/router");

test("the router preloads on viewport and lets React Query own preload freshness", async () => {
  vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
  await using _env = makeResource({}, () => {
    vi.unstubAllEnvs();
  });
  createRouter.mockClear();

  getRouter();

  expect(createRouter).toHaveBeenCalledTimes(1);
  const options = createRouter.mock.calls[0]?.[0];
  expect(options).toMatchObject({
    defaultPreload: "viewport",
    // React Query is the cache of record: preloaded loader data must be
    // immediately stale to the router so ensureQueryData decides freshness.
    // Navigations to preloaded matches still commit instantly (stale matches
    // revalidate in the background).
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  });
  const context = options?.context as { queryClient: QueryClient } | undefined;
  expect(context?.queryClient.getDefaultOptions().queries?.queryFn).toBe(defaultQueryFn);
});
