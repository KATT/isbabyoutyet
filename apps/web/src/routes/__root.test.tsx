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
  authClient: {
    useSession: () => session.value,
    getSession: vi.fn(),
    convex: { token: vi.fn() },
  },
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
  contextLocale,
  requireAuthClient,
} = await import("@/routes/__root");

function renderResource(ui: ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("route context locales are narrowed to supported values", () => {
  expect(contextLocale({ locale: "sv" })).toBe("sv");
  expect(contextLocale({ locale: "unsupported" })).toBeUndefined();
  expect(contextLocale({ locale: 1 })).toBeUndefined();
  expect(contextLocale({})).toBeUndefined();
  expect(contextLocale(null)).toBeUndefined();
});

test("the Convex auth adapter validates its required client surface", () => {
  const validClient = {
    useSession: vi.fn(),
    getSession: vi.fn(),
    convex: { token: vi.fn() },
  };
  expect(requireAuthClient(validClient)).toBe(validClient);

  const invalidClients = [
    null,
    {},
    { useSession: "not a function" },
    { useSession: vi.fn(), getSession: "not a function" },
    { useSession: vi.fn(), getSession: vi.fn(), convex: null },
    { useSession: vi.fn(), getSession: vi.fn(), convex: {} },
    { useSession: vi.fn(), getSession: vi.fn(), convex: { token: "not a function" } },
  ];
  for (const invalidClient of invalidClients) {
    expect(() => requireAuthClient(invalidClient)).toThrow(
      "Better Auth client is missing its Convex integration",
    );
  }
});

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

test("the root component renders the document shell", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  routeContext.value = {
    convexQueryClient: { convexClient: {} },
    queryClient: new QueryClient(),
    locale: "en-GB",
    token: null,
  };
  const RootComponent = (Route as unknown as { component: () => ReactElement }).component;

  await using _view = renderResource(<RootComponent />);

  // React 19 hoists the <html> element onto the real document.
  expect(document.documentElement.getAttribute("lang")).toBe("en-GB");
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
