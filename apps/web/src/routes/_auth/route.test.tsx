import { QueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { isRedirect } from "@tanstack/react-router";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";
import { resolveAuthGuard, Route } from "@/routes/_auth/route";

test("auth layout is wired as the route component", () => {
  expect(Route.options.component).toBeTypeOf("function");
});

type GuardCtx = {
  convexClient:
    | { setAuth: (fetchToken: () => Promise<string | null>) => void }
    | Record<string, never>;
  convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
  convexQueryClient: {
    serverHttpClient: { setAuth: (token: string) => void };
  };
  queryClient: QueryClient;
  token: string | null;
};

type ProfileSnapshot = {
  isAdmin: boolean;
  locale: string;
  timeZone: string;
};

function makeGuardCtx() {
  const queryFn = vi.fn<() => Promise<null | ProfileSnapshot>>(() => Promise.resolve(null));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { queryFn, retry: false } },
  });
  const setServerAuth = vi.fn<(token: string) => void>();
  const context: GuardCtx = {
    convexClient: {},
    convexPreloader: getConvexQueryPreloader(queryClient),
    convexQueryClient: { serverHttpClient: { setAuth: setServerAuth } },
    queryClient,
    token: null,
  };
  return { context, queryClient, queryFn, setServerAuth };
}

async function runGuard(opts: { context: GuardCtx; fetchToken: () => Promise<string | null> }) {
  return await resolveAuthGuard({
    // SAFETY: Test fixture is a subset of the production type.
    context: opts.context as Parameters<typeof resolveAuthGuard>[0]["context"],
    fetchToken: opts.fetchToken,
    waitForCatchup: async () => {},
  });
}

/** Guard runs that are expected to throw a redirect (result is never observed). */
type GuardRunResult = object | null | void;

async function expectRedirectHome(run: () => Promise<GuardRunResult>) {
  try {
    await run();
    expect.unreachable("expected a redirect");
  } catch (error) {
    expect(isRedirect(error)).toBe(true);
    if (isRedirect(error)) {
      expect(error.options.to).toBe("/");
    }
  }
}

function withoutBrowserWindow(run: () => Promise<void>) {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: undefined });
  return run().finally(() => {
    if (windowDescriptor) {
      Object.defineProperty(globalThis, "window", windowDescriptor);
    }
  });
}

test("client navigations reuse a cached profile without an auth round-trip", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>();
  const guard = makeGuardCtx();
  guard.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, {
    isAdmin: false,
    locale: "sv",
    timeZone: "Europe/London",
  });

  const result = await runGuard({ context: guard.context, fetchToken });

  expect(result).toMatchObject({ isAuthenticated: true, locale: "sv" });
  expect(fetchToken).not.toHaveBeenCalled();
  expect(guard.queryFn).not.toHaveBeenCalled();
});

test("a missing cached profile retries once without taking auth ownership from the provider", async () => {
  // An anonymous profile may still be cached from public pages. The guard
  // refetches after a token check without replacing the provider's callback.
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce("fresh-token");
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const guard = makeGuardCtx();
  guard.queryClient.setQueryData(convexQuery(api.baby.listByUser, {}).queryKey, []);
  guard.queryFn
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ isAdmin: false, locale: "en-US", timeZone: "Europe/London" });
  guard.context.convexClient = { setAuth };

  const result = await runGuard({ context: guard.context, fetchToken });

  expect(result).toMatchObject({ isAuthenticated: true, locale: "en-US" });
  expect(setAuth).not.toHaveBeenCalled();
  expect(
    guard.queryClient.getQueryData(convexQuery(api.baby.listByUser, {}).queryKey),
  ).toBeUndefined();
  // The ensured profile lands in the cache for subsequent navigations.
  expect(guard.queryClient.getQueryData(convexQuery(api.profile.get, {}).queryKey)).toMatchObject({
    locale: "en-US",
  });
});

test("client navigations wait for Convex to catch up after sign-in", async () => {
  // Better Auth's cookie is set before ConvexBetterAuthProvider's effect
  // authenticates the websocket. One refetch still sees a null profile and
  // used to bounce to `/` instead of /dashboard.
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValue("fresh-token");
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const guard = makeGuardCtx();
  guard.context.convexClient = { setAuth };
  guard.queryFn
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ isAdmin: false, locale: "en-US", timeZone: "Europe/London" });

  const result = await runGuard({ context: guard.context, fetchToken });

  expect(result).toMatchObject({ isAuthenticated: true, locale: "en-US" });
  expect(setAuth).not.toHaveBeenCalled();
});

test("client navigations without a session redirect home after one token check", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce(null);
  const guard = makeGuardCtx();

  await expectRedirectHome(() => runGuard({ context: guard.context, fetchToken }));
  expect(fetchToken).toHaveBeenCalledTimes(1);
});

test("client navigations redirect when an authenticated profile cannot be read", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce("fresh-token");
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const guard = makeGuardCtx();
  guard.context.convexClient = { setAuth };

  await expectRedirectHome(() => runGuard({ context: guard.context, fetchToken }));
  expect(setAuth).not.toHaveBeenCalled();
});

test("client navigations keep the cached profile", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>();
  const cachedProfile = { isAdmin: false, locale: "sv", timeZone: "Europe/London" };
  const guard = makeGuardCtx();
  guard.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, cachedProfile);

  const result = await runGuard({ context: guard.context, fetchToken });

  expect(result).toMatchObject({ isAuthenticated: true, locale: "sv" });
  expect(guard.queryClient.getQueryData(convexQuery(api.profile.get, {}).queryKey)).toEqual(
    cachedProfile,
  );
  expect(guard.queryFn).not.toHaveBeenCalled();
});

test("server render redirects home when no auth token is available", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce(null);
  const guard = makeGuardCtx();

  await withoutBrowserWindow(async () => {
    await expectRedirectHome(() => runGuard({ context: guard.context, fetchToken }));
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });
});

test("server render reuses the layout token without calling getAuthToken", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>();
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const guard = makeGuardCtx();
  guard.queryFn.mockResolvedValueOnce({
    isAdmin: false,
    locale: "en-GB",
    timeZone: "Europe/London",
  });
  guard.context.token = "ssr-token";
  guard.context.convexClient = { setAuth };

  await withoutBrowserWindow(async () => {
    const result = await runGuard({ context: guard.context, fetchToken });

    expect(result).toMatchObject({
      isAuthenticated: true,
      locale: "en-GB",
      token: "ssr-token",
    });
    expect(fetchToken).not.toHaveBeenCalled();
    expect(guard.setServerAuth).toHaveBeenCalledWith("ssr-token");
    expect(setAuth).toHaveBeenCalledTimes(1);
    expect(guard.queryFn).toHaveBeenCalledTimes(1);
  });
});

test("server render redirects when its authenticated profile cannot be read", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>();
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const guard = makeGuardCtx();
  guard.context.token = "ssr-token";
  guard.context.convexClient = { setAuth };

  await withoutBrowserWindow(async () => {
    await expectRedirectHome(() => runGuard({ context: guard.context, fetchToken }));
    expect(setAuth).toHaveBeenCalledTimes(1);
    expect(guard.queryFn).toHaveBeenCalledTimes(1);
  });
});
