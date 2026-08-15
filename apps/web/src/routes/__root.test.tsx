import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";

const routerState = vi.hoisted(() => ({ isLoading: false }));
const routeContext = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock("@tanstack/react-router", () => ({
  HeadContent: () => null,
  Link: (props: React.ComponentProps<"a"> & { to: string | undefined }) => (
    <a href={typeof props.to === "string" ? props.to : "#"} {...props} />
  ),
  Outlet: () => null,
  Scripts: () => null,
  createRootRouteWithContext: () => (opts: unknown) => opts,
  useMatches: () => [],
  useRouteContext: () => routeContext.value,
  useRouterState: (opts: { select: (state: typeof routerState) => unknown }) =>
    opts.select(routerState),
}));

vi.mock("next-themes", () => ({
  ThemeProvider: (props: { children: React.ReactNode }) => props.children,
  useTheme: () => ({ theme: "light", setTheme: () => {} }),
}));

vi.mock("@/components/dev-bar", () => ({
  DevBar: () => null,
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

const {
  NavigationProgress,
  NotFoundComponent,
  RootErrorComponent,
  Route,
  useResolveAnonymousAuth,
} = await import("@/routes/__root");

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
  const { QueryClient } = await import("@tanstack/react-query");
  const { convexQuery } = await import("@convex-dev/react-query");
  const { api } = await import("@workspace/convex/convex/_generated/api");
  const setAuth = vi.fn<(fetchToken: unknown) => void>();
  const convexQueryClient = { convexClient: { setAuth } };
  const queryClient = new QueryClient();
  const profileKey = convexQuery(api.profile.get, {}).queryKey;
  // A stale profile from an expired session must not survive the anonymous
  // resolution — it is the /_auth guard's session signal.
  queryClient.setQueryData(profileKey, { locale: "sv", isAdmin: false });

  // Still resolving: don't touch auth yet.
  session.value = { data: null, isPending: true };
  const hook = renderHook(() => useResolveAnonymousAuth(convexQueryClient as never, queryClient));
  await using _hook = makeResource(hook, () => {
    hook.unmount();
  });
  expect(setAuth).not.toHaveBeenCalled();
  expect(queryClient.getQueryData(profileKey)).not.toBeNull();

  // Resolved anonymous: resume the socket and clear the stale profile.
  session.value = { data: null, isPending: false };
  hook.rerender();
  expect(setAuth).toHaveBeenCalledTimes(1);
  const fetchToken = setAuth.mock.calls[0]?.[0] as () => Promise<string | null>;
  expect(await fetchToken()).toBeNull();
  expect(queryClient.getQueryData(profileKey)).toBeNull();

  // Signed in: ConvexProviderWithAuth owns setAuth — nothing to do here.
  setAuth.mockClear();
  queryClient.setQueryData(profileKey, { locale: "sv", isAdmin: false });
  session.value = { data: { session: { id: "s1" } }, isPending: false };
  hook.rerender();
  expect(setAuth).not.toHaveBeenCalled();
  expect(queryClient.getQueryData(profileKey)).not.toBeNull();
});

test("regression: rendering the root as an anonymous visitor resumes the paused Convex socket", async () => {
  // Repro of the frozen-navigation bug: expectAuth pauses the websocket and
  // ConvexProviderWithAuth never resolves signed-out visitors, so unless the
  // root explicitly calls setAuth for them, their client-side queries hang.
  const { QueryClient } = await import("@tanstack/react-query");
  const setAuth = vi.fn<(fetchToken: unknown) => void>();
  routeContext.value = {
    convexQueryClient: { convexClient: { setAuth } },
    queryClient: new QueryClient(),
    locale: "en-GB",
    token: null,
  };
  session.value = { data: null, isPending: false };
  const RootComponent = (Route as unknown as { component: () => ReactElement }).component;

  await using _view = renderResource(<RootComponent />);

  expect(setAuth).toHaveBeenCalledTimes(1);
});

test("the error page offers reload and go-home recovery, with details in dev", async () => {
  await using view = renderResource(<RootErrorComponent error={new Error("boom")} />);

  expect(view.getByText("Something went wrong")).toBeTruthy();
  expect(view.getByText("Go Home")).toBeTruthy();
  expect(view.getByText("boom")).toBeTruthy();

  // Recovery: the reload button triggers a full page reload (jsdom no-ops it).
  view.getByText("Reload page").click();
});

test("the error page hides technical details outside dev", async () => {
  vi.stubEnv("DEV", false);
  await using _env = makeResource({}, () => {
    vi.unstubAllEnvs();
  });

  await using view = renderResource(<RootErrorComponent error={new Error("boom")} />);

  expect(view.getByText("Something went wrong")).toBeTruthy();
  expect(view.queryByText("boom")).toBeNull();
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
