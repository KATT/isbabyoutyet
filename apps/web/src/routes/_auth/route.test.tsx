import { QueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";

const getToken = vi.hoisted(() => vi.fn<() => Promise<string | null>>());

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: unknown) => opts,
  Outlet: () => null,
  redirect: (opts: unknown) => ({ isRedirect: true, ...(opts as object) }),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (fn: unknown) => fn }),
}));

vi.mock("@/lib/auth-server", () => ({
  authServer: { getToken },
}));

const { Route } = await import("@/routes/_auth/route");

test("auth layout renders its child outlet", () => {
  const options = Route as unknown as { component: () => unknown };

  expect(options.component()).toBeTruthy();
});

type GuardCtx = {
  context: {
    queryClient: QueryClient;
    convexClient: unknown;
    convexQueryClient: {
      serverHttpClient: { setAuth: (token: string) => void };
    };
    convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    token: string | null;
    locale: string;
  };
};

function makeGuardCtx() {
  const queryFn = vi.fn<() => Promise<unknown>>(() => Promise.resolve(null));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn } },
  });
  const setServerAuth = vi.fn<(token: string) => void>();
  const ctx: GuardCtx = {
    context: {
      queryClient,
      convexClient: {},
      convexQueryClient: { serverHttpClient: { setAuth: setServerAuth } },
      convexPreloader: getConvexQueryPreloader(queryClient),
      token: null,
      locale: "en-GB",
    },
  };
  const options = Route as unknown as {
    beforeLoad: (opts: GuardCtx) => Promise<{
      locale: string;
      isAuthenticated: boolean;
      profile: { input: Record<string, never>; initialData: unknown };
    }>;
  };
  return { ctx, queryClient, queryFn, setServerAuth, beforeLoad: options.beforeLoad };
}

test("client navigations reuse a cached profile without an auth round-trip", async () => {
  getToken.mockReset();
  const guard = makeGuardCtx();
  guard.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, {
    locale: "sv",
    timeZone: "Europe/London",
    isAdmin: false,
  });

  const result = await guard.beforeLoad(guard.ctx);

  expect(result).toMatchObject({ locale: "sv", isAuthenticated: true });
  expect(getToken).not.toHaveBeenCalled();
  expect(guard.queryFn).not.toHaveBeenCalled();
});

test("a fresh login retries the profile without taking auth ownership from the provider", async () => {
  // The login handoff waits for provider-confirmed auth before navigating. If
  // an anonymous profile result is still cached, the guard may safely refetch
  // it without replacing the provider's token callback.
  getToken.mockReset();
  getToken.mockResolvedValueOnce("fresh-token");
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const guard = makeGuardCtx();
  guard.queryFn
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ locale: "en-US", timeZone: "Europe/London", isAdmin: false });
  guard.ctx.context.convexClient = { setAuth };

  const result = await guard.beforeLoad(guard.ctx);

  expect(result).toMatchObject({ locale: "en-US", isAuthenticated: true });
  expect(setAuth).not.toHaveBeenCalled();
  // The ensured profile lands in the cache for subsequent navigations.
  expect(guard.queryClient.getQueryData(convexQuery(api.profile.get, {}).queryKey)).toMatchObject({
    locale: "en-US",
  });
});

test("client navigations without a session redirect home after one token check", async () => {
  getToken.mockReset();
  getToken.mockResolvedValueOnce(null);
  const guard = makeGuardCtx();

  await expect(guard.beforeLoad(guard.ctx)).rejects.toMatchObject({
    isRedirect: true,
    to: "/",
  });
  expect(getToken).toHaveBeenCalledTimes(1);
});

test("client navigations redirect when an authenticated profile cannot be read", async () => {
  getToken.mockReset();
  getToken.mockResolvedValueOnce("fresh-token");
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const guard = makeGuardCtx();
  guard.ctx.context.convexClient = { setAuth };

  await expect(guard.beforeLoad(guard.ctx)).rejects.toMatchObject({
    isRedirect: true,
    to: "/",
  });
  expect(setAuth).not.toHaveBeenCalled();
  expect(guard.queryFn).toHaveBeenCalledTimes(2);
});

test("client navigations keep the cached profile", async () => {
  getToken.mockReset();
  const cachedProfile = { locale: "sv", timeZone: "Europe/London", isAdmin: false };
  const guard = makeGuardCtx();
  guard.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, cachedProfile);

  const result = await guard.beforeLoad(guard.ctx);

  expect(result).toMatchObject({ locale: "sv", isAuthenticated: true });
  expect(guard.queryClient.getQueryData(convexQuery(api.profile.get, {}).queryKey)).toEqual(
    cachedProfile,
  );
  expect(guard.queryFn).not.toHaveBeenCalled();
});

function withoutBrowserWindow(run: () => Promise<void>) {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { value: undefined, configurable: true });
  return run().finally(() => {
    if (windowDescriptor) {
      Object.defineProperty(globalThis, "window", windowDescriptor);
    }
  });
}

test("server render redirects home when no auth token is available", async () => {
  getToken.mockReset();
  getToken.mockResolvedValueOnce(null);
  const guard = makeGuardCtx();

  await withoutBrowserWindow(async () => {
    await expect(guard.beforeLoad(guard.ctx)).rejects.toMatchObject({
      isRedirect: true,
      to: "/",
    });
    expect(getToken).toHaveBeenCalledTimes(1);
  });
});

test("server render reuses the layout token without calling getAuthToken", async () => {
  getToken.mockReset();
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const guard = makeGuardCtx();
  guard.queryFn.mockResolvedValueOnce({
    locale: "en-GB",
    timeZone: "Europe/London",
    isAdmin: false,
  });
  guard.ctx.context.token = "ssr-token";
  guard.ctx.context.convexClient = { setAuth };

  await withoutBrowserWindow(async () => {
    const result = await guard.beforeLoad(guard.ctx);

    expect(result).toMatchObject({
      locale: "en-GB",
      token: "ssr-token",
      isAuthenticated: true,
    });
    expect(getToken).not.toHaveBeenCalled();
    expect(guard.setServerAuth).toHaveBeenCalledWith("ssr-token");
    expect(setAuth).toHaveBeenCalledTimes(1);
    expect(guard.queryFn).toHaveBeenCalledTimes(1);
  });
});

test("server render redirects when its authenticated profile cannot be read", async () => {
  getToken.mockReset();
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const guard = makeGuardCtx();
  guard.ctx.context.token = "ssr-token";
  guard.ctx.context.convexClient = { setAuth };

  await withoutBrowserWindow(async () => {
    await expect(guard.beforeLoad(guard.ctx)).rejects.toMatchObject({
      isRedirect: true,
      to: "/",
    });
    expect(setAuth).toHaveBeenCalledTimes(1);
    expect(guard.queryFn).toHaveBeenCalledTimes(1);
  });
});
