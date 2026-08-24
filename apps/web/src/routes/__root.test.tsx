import { act, render } from "@testing-library/react";
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

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    isRefreshing: false,
  }),
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

const detectRequestLocale = vi.hoisted(() => vi.fn(() => Promise.resolve("sv")));

vi.mock("@/lib/detect-locale", () => ({
  detectRequestLocale,
}));

const {
  NAVIGATION_PROGRESS_DELAY_MS,
  NavigationProgress,
  NotFoundComponent,
  RootErrorComponent,
  Route,
} = await import("@/routes/__root");

function renderResource(ui: ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

// With createRootRouteWithContext mocked, Route is the options object.
const rootOptions = Route as unknown as {
  beforeLoad: () => Promise<{ locale: string; isAuthenticated: boolean; token: string | null }>;
};

function withoutBrowserWindow(run: () => Promise<void>) {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { value: undefined, configurable: true });
  return run().finally(() => {
    if (windowDescriptor) {
      Object.defineProperty(globalThis, "window", windowDescriptor);
    }
  });
}

test("beforeLoad keeps shared document rendering anonymous", async () => {
  const anonymous = await rootOptions.beforeLoad();
  expect(anonymous.locale).toBeTruthy();
  expect(anonymous.isAuthenticated).toBe(false);
  expect(anonymous.token).toBeNull();
});

test("client navigations resolve the locale without a server round-trip", async () => {
  // Regression (PR #112 undid PR #108): the root beforeLoad blocks every
  // client navigation, so calling the detect-locale server function made all
  // cached navigations wait on an HTTP request and flash the progress bar.
  detectRequestLocale.mockClear();

  const result = await rootOptions.beforeLoad();

  expect(result.locale).toBeTruthy();
  expect(detectRequestLocale).not.toHaveBeenCalled();
});

test("server rendering resolves the locale from request headers", async () => {
  detectRequestLocale.mockClear();

  await withoutBrowserWindow(async () => {
    const result = await rootOptions.beforeLoad();

    expect(result.locale).toBe("sv");
    expect(detectRequestLocale).toHaveBeenCalledTimes(1);
  });
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

test("an indeterminate progress bar renders once loading outlasts the delay", async () => {
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });
  routerState.isLoading = true;
  await using view = renderResource(<NavigationProgress />);

  // The router flips isLoading true on every navigation, cached ones
  // included — nothing may render before the delay elapses.
  expect(view.queryByRole("progressbar")).toBeNull();

  act(() => {
    vi.advanceTimersByTime(NAVIGATION_PROGRESS_DELAY_MS);
  });

  const progressbar = view.getByRole("progressbar", { name: "Loading" });
  expect(progressbar.dataset.indeterminate).toBeDefined();
  expect(progressbar.className).toContain("animate-progress-indeterminate");
});

test("fast navigations never flash the progress bar", async () => {
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });
  routerState.isLoading = true;
  await using view = renderResource(<NavigationProgress />);

  // Navigation finishes before the delay elapses (instant, cache-served nav).
  act(() => {
    vi.advanceTimersByTime(NAVIGATION_PROGRESS_DELAY_MS - 1);
  });
  routerState.isLoading = false;
  view.rerender(<NavigationProgress />);

  act(() => {
    vi.advanceTimersByTime(NAVIGATION_PROGRESS_DELAY_MS * 5);
  });
  expect(view.queryByRole("progressbar")).toBeNull();
});

test("the progress bar hides as soon as loading resolves", async () => {
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });
  routerState.isLoading = true;
  await using view = renderResource(<NavigationProgress />);

  act(() => {
    vi.advanceTimersByTime(NAVIGATION_PROGRESS_DELAY_MS);
  });
  expect(view.getByRole("progressbar", { name: "Loading" })).toBeTruthy();

  routerState.isLoading = false;
  view.rerender(<NavigationProgress />);

  expect(view.queryByRole("progressbar")).toBeNull();
});
