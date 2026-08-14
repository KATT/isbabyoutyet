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

vi.mock("@/lib/auth-client", () => ({
  authClient: {},
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (fn: unknown) => fn }),
}));

vi.mock("@/lib/auth-server", () => ({
  authServer: { getToken: vi.fn<() => Promise<string | null>>(() => Promise.resolve(null)) },
}));

const { NavigationProgress, Route } = await import("@/routes/__root");

function renderResource(ui: ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("beforeLoad resolves the locale locally on the client, without a server round-trip", async () => {
  // With createRootRouteWithContext mocked, Route is the options object.
  const options = Route as unknown as {
    beforeLoad: (ctx: {
      context: { convexQueryClient: { serverHttpClient: undefined } };
    }) => Promise<{ locale: string; isAuthenticated: boolean }>;
  };

  const result = await options.beforeLoad({
    context: { convexQueryClient: { serverHttpClient: undefined } },
  });

  expect(result.locale).toBeTruthy();
  expect(result.isAuthenticated).toBe(false);
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
