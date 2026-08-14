import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";

const routerState = vi.hoisted(() => ({ isLoading: false }));

vi.mock("@tanstack/react-router", () => ({
  HeadContent: () => null,
  Link: (props: React.ComponentProps<"a"> & { to: string | undefined }) => (
    <a href={typeof props.to === "string" ? props.to : "#"} {...props} />
  ),
  Outlet: () => null,
  Scripts: () => null,
  createRootRouteWithContext: () => (opts: unknown) => opts,
  useMatches: () => [],
  useRouteContext: () => ({}),
  useRouterState: (opts: { select: (state: typeof routerState) => unknown }) =>
    opts.select(routerState),
}));

vi.mock("@tanstack/react-router-devtools", () => ({
  TanStackRouterDevtoolsPanel: () => null,
}));

vi.mock("@tanstack/react-devtools", () => ({
  TanStackDevtools: () => null,
}));

vi.mock("@convex-dev/better-auth/react", () => ({
  ConvexBetterAuthProvider: (props: { children: React.ReactNode }) => props.children,
}));

vi.mock("@vercel/analytics/react", () => ({
  Analytics: () => null,
}));

const session = vi.hoisted(() => ({
  value: { data: null as unknown, isPending: true },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => session.value },
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (fn: unknown) => fn }),
}));

vi.mock("@/lib/auth-server", () => ({
  authServer: { getToken: vi.fn<() => Promise<string | null>>(() => Promise.resolve(null)) },
}));

const { NavigationProgress, NotFoundComponent, Route, useResolveAnonymousAuth } =
  await import("@/routes/__root");

function renderResource(ui: ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("beforeLoad resolves locale and auth locally on the client, without a server round-trip", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  const { convexQuery } = await import("@convex-dev/react-query");
  const { api } = await import("@workspace/convex/convex/_generated/api");
  const queryClient = new QueryClient();
  // With createRootRouteWithContext mocked, Route is the options object.
  const options = Route as unknown as {
    beforeLoad: (ctx: {
      context: { queryClient: unknown; convexQueryClient: { serverHttpClient: undefined } };
    }) => Promise<{ locale: string; isAuthenticated: boolean; token: string | null }>;
  };
  const ctx = { context: { queryClient, convexQueryClient: { serverHttpClient: undefined } } };

  const anonymous = await options.beforeLoad(ctx);
  expect(anonymous.locale).toBeTruthy();
  expect(anonymous.isAuthenticated).toBe(false);

  // A cached profile is the session signal for client navigations.
  queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, {
    locale: "sv",
    isAdmin: false,
  });
  const authed = await options.beforeLoad(ctx);
  expect(authed.isAuthenticated).toBe(true);
});

test("an empty session resumes the expectAuth-paused Convex socket; a real session does not", async () => {
  const { renderHook } = await import("@testing-library/react");
  const setAuth = vi.fn<(fetchToken: unknown) => void>();
  const convexQueryClient = { convexClient: { setAuth } };

  // Still resolving: don't touch auth yet.
  session.value = { data: null, isPending: true };
  const hook = renderHook(() => useResolveAnonymousAuth(convexQueryClient as never));
  await using _hook = makeResource(hook, () => {
    hook.unmount();
  });
  expect(setAuth).not.toHaveBeenCalled();

  // Resolved anonymous: resume the socket so client-side queries can run.
  session.value = { data: null, isPending: false };
  hook.rerender();
  expect(setAuth).toHaveBeenCalledTimes(1);
  const fetchToken = setAuth.mock.calls[0]?.[0] as () => Promise<string | null>;
  expect(await fetchToken()).toBeNull();

  // Signed in: ConvexProviderWithAuth owns setAuth — nothing to do here.
  setAuth.mockClear();
  session.value = { data: { session: { id: "s1" } }, isPending: false };
  hook.rerender();
  expect(setAuth).not.toHaveBeenCalled();
});

test("the not-found page offers a way back home", async () => {
  await using view = renderResource(<NotFoundComponent />);

  expect(view.getByText("404")).toBeTruthy();
  expect(view.getByText("Go Home")).toBeTruthy();
});

test("no progress bar renders while the router is idle", async () => {
  routerState.isLoading = false;
  await using view = renderResource(<NavigationProgress />);

  expect(view.queryByRole("progressbar")).toBeNull();
});

test("an indeterminate progress bar renders while the router loads the next page", async () => {
  routerState.isLoading = true;
  await using view = renderResource(<NavigationProgress />);

  const progressbar = view.getByRole("progressbar", { name: "Loading" });
  expect(progressbar.dataset.indeterminate).toBeDefined();
});
