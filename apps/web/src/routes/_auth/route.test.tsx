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
  queryClient: QueryClient;
  convexClient:
    | { setAuth: (fetchToken: () => Promise<string | null>) => void }
    | Record<string, never>;
  convexQueryClient: {
    serverHttpClient: { setAuth: (token: string) => void };
  };
  convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
  token: string | null;
};

function makeGuardCtx() {
  const queryFn = vi.fn<() => Promise<unknown>>(() => Promise.resolve(null));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn } },
  });
  const setServerAuth = vi.fn<(token: string) => void>();
  const context: GuardCtx = {
    queryClient,
    convexClient: {},
    convexQueryClient: { serverHttpClient: { setAuth: setServerAuth } },
    convexPreloader: getConvexQueryPreloader(queryClient),
    token: null,
  };
  return { context, queryClient, queryFn, setServerAuth };
}

async function runGuard(opts: { context: GuardCtx; fetchToken: () => Promise<string | null> }) {
  return await resolveAuthGuard({
    context: opts.context as Parameters<typeof resolveAuthGuard>[0]["context"],
    fetchToken: opts.fetchToken,
  });
}

async function expectRedirectHome(run: () => Promise<unknown>) {
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
  Object.defineProperty(globalThis, "window", { value: undefined, configurable: true });
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
    locale: "sv",
    timeZone: "Europe/London",
    isAdmin: false,
  });

  const result = await runGuard({ context: guard.context, fetchToken });

  expect(result).toMatchObject({ locale: "sv", isAuthenticated: true });
  expect(fetchToken).not.toHaveBeenCalled();
  expect(guard.queryFn).not.toHaveBeenCalled();
});

test("a fresh login retries the profile without taking auth ownership from the provider", async () => {
  // The login handoff waits for provider-confirmed auth before navigating. If
  // an anonymous profile result is still cached, the guard may safely refetch
  // it without replacing the provider's token callback.
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce("fresh-token");
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const guard = makeGuardCtx();
  guard.queryFn
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ locale: "en-US", timeZone: "Europe/London", isAdmin: false });
  guard.context.convexClient = { setAuth };

  const result = await runGuard({ context: guard.context, fetchToken });

  expect(result).toMatchObject({ locale: "en-US", isAuthenticated: true });
  expect(setAuth).not.toHaveBeenCalled();
  // The ensured profile lands in the cache for subsequent navigations.
  expect(guard.queryClient.getQueryData(convexQuery(api.profile.get, {}).queryKey)).toMatchObject({
    locale: "en-US",
  });
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
  expect(guard.queryFn).toHaveBeenCalledTimes(2);
});

test("client navigations keep the cached profile", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>();
  const cachedProfile = { locale: "sv", timeZone: "Europe/London", isAdmin: false };
  const guard = makeGuardCtx();
  guard.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, cachedProfile);

  const result = await runGuard({ context: guard.context, fetchToken });

  expect(result).toMatchObject({ locale: "sv", isAuthenticated: true });
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
    locale: "en-GB",
    timeZone: "Europe/London",
    isAdmin: false,
  });
  guard.context.token = "ssr-token";
  guard.context.convexClient = { setAuth };

  await withoutBrowserWindow(async () => {
    const result = await runGuard({ context: guard.context, fetchToken });

    expect(result).toMatchObject({
      locale: "en-GB",
      token: "ssr-token",
      isAuthenticated: true,
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
