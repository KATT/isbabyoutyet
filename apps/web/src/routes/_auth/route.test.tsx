import { QueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { isRedirect } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";
import { resolveAuthGuard, Route } from "@/routes/_auth/route";

test("auth layout renders its child outlet", async () => {
  // Drive the real layout component from a bare test root so only its
  // `<Outlet />` is under test, without the auth guard or the generated tree.
  const rootRoute = createRootRoute({ component: Route.options.component });
  const childRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>dashboard content</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([childRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    defaultPendingMinMs: 0,
  });
  await router.load();

  const rendered = render(<RouterProvider router={router} />);
  await using view = makeResource(rendered, () => {
    rendered.unmount();
  });

  expect(view.getByText("dashboard content")).toBeTruthy();
});

function makeGuard() {
  const queryFn = vi.fn<() => Promise<unknown>>(() => Promise.resolve(null));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn } },
  });
  const setServerAuth = vi.fn<(token: string) => void>();
  const setClientAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const fetchToken = vi.fn<() => Promise<string | null>>(() => Promise.resolve(null));
  const context = {
    queryClient,
    convexClient: { setAuth: setClientAuth },
    convexQueryClient: { serverHttpClient: { setAuth: setServerAuth } },
    convexPreloader: getConvexQueryPreloader(queryClient),
    token: null as string | null,
  };
  return {
    context,
    queryClient,
    queryFn,
    setServerAuth,
    setClientAuth,
    fetchToken,
    run: () => resolveAuthGuard({ context: context as never, fetchToken }),
  };
}

/**
 * The real `redirect()` throws a `Response` subclass, so assert through
 * TanStack's own guard rather than on the thrown object's shape.
 */
async function expectRedirectHome(run: () => Promise<unknown>) {
  const thrown = await run().then(
    () => null,
    (error: unknown) => error,
  );
  expect(isRedirect(thrown)).toBe(true);
  expect((thrown as { options: { to: string } }).options.to).toBe("/");
}

function withoutBrowserWindowResource() {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { value: undefined, configurable: true });
  return makeResource({}, () => {
    if (descriptor) {
      Object.defineProperty(globalThis, "window", descriptor);
    }
  });
}

test("client navigations reuse a cached profile without an auth round-trip", async () => {
  const guard = makeGuard();
  guard.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, {
    locale: "sv",
    timeZone: "Europe/London",
    isAdmin: false,
  });

  const result = await guard.run();

  expect(result).toMatchObject({ locale: "sv", isAuthenticated: true });
  expect(guard.fetchToken).not.toHaveBeenCalled();
  expect(guard.queryFn).not.toHaveBeenCalled();
});

test("a fresh login retries the profile without taking auth ownership from the provider", async () => {
  // The login handoff waits for provider-confirmed auth before navigating. If
  // an anonymous profile result is still cached, the guard may safely refetch
  // it without replacing the provider's token callback.
  const guard = makeGuard();
  guard.fetchToken.mockResolvedValueOnce("fresh-token");
  guard.queryFn
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ locale: "en-US", timeZone: "Europe/London", isAdmin: false });

  const result = await guard.run();

  expect(result).toMatchObject({ locale: "en-US", isAuthenticated: true });
  expect(guard.setClientAuth).not.toHaveBeenCalled();
  // The ensured profile lands in the cache for subsequent navigations.
  expect(guard.queryClient.getQueryData(convexQuery(api.profile.get, {}).queryKey)).toMatchObject({
    locale: "en-US",
  });
});

test("client navigations without a session redirect home after one token check", async () => {
  const guard = makeGuard();

  await expectRedirectHome(guard.run);
  expect(guard.fetchToken).toHaveBeenCalledTimes(1);
});

test("client navigations redirect when an authenticated profile cannot be read", async () => {
  const guard = makeGuard();
  guard.fetchToken.mockResolvedValueOnce("fresh-token");

  await expectRedirectHome(guard.run);
  expect(guard.setClientAuth).not.toHaveBeenCalled();
  expect(guard.queryFn).toHaveBeenCalledTimes(2);
});

test("client navigations keep the cached profile", async () => {
  const cachedProfile = { locale: "sv", timeZone: "Europe/London", isAdmin: false };
  const guard = makeGuard();
  guard.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, cachedProfile);

  const result = await guard.run();

  expect(result).toMatchObject({ locale: "sv", isAuthenticated: true });
  expect(guard.queryClient.getQueryData(convexQuery(api.profile.get, {}).queryKey)).toEqual(
    cachedProfile,
  );
  expect(guard.queryFn).not.toHaveBeenCalled();
});

test("server render redirects home when no auth token is available", async () => {
  await using _window = withoutBrowserWindowResource();
  const guard = makeGuard();

  await expectRedirectHome(guard.run);
  expect(guard.fetchToken).toHaveBeenCalledTimes(1);
});

test("server render reuses the layout token without calling getAuthToken", async () => {
  await using _window = withoutBrowserWindowResource();
  const guard = makeGuard();
  guard.queryFn.mockResolvedValueOnce({
    locale: "en-GB",
    timeZone: "Europe/London",
    isAdmin: false,
  });
  guard.context.token = "ssr-token";

  const result = await guard.run();

  expect(result).toMatchObject({ locale: "en-GB", token: "ssr-token", isAuthenticated: true });
  expect(guard.fetchToken).not.toHaveBeenCalled();
  expect(guard.setServerAuth).toHaveBeenCalledWith("ssr-token");
  expect(guard.setClientAuth).toHaveBeenCalledTimes(1);
  expect(guard.queryFn).toHaveBeenCalledTimes(1);
});

test("server render redirects when its authenticated profile cannot be read", async () => {
  await using _window = withoutBrowserWindowResource();
  const guard = makeGuard();
  guard.context.token = "ssr-token";

  await expectRedirectHome(guard.run);
  expect(guard.setClientAuth).toHaveBeenCalledTimes(1);
  expect(guard.queryFn).toHaveBeenCalledTimes(1);
});
