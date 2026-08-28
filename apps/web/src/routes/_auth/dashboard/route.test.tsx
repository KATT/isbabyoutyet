import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AnyRoute } from "@tanstack/react-router";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import type { FunctionReturnType } from "convex/server";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { LocaleProvider } from "@/lib/i18n";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { DashboardBabyList, DashboardHeader, Route } from "@/routes/_auth/dashboard/route";

const babySmith = {
  _id: "baby-id" as Id<"baby">,
  name: "Baby Smith",
  timeZone: "Europe/London",
  publicId: "baby-smith",
  dueDate: "2026-12-01",
  dueDateDisplayMode: "exact" as const,
  publicDueDateText: null,
  laborStarted: null,
  wentToHospital: null,
  babyBorn: null,
  role: "owner" as const,
};

const onboardingProgress: FunctionReturnType<typeof api.onboarding.getMine> = {
  welcomeDismissed: true,
  checklistDismissed: true,
  minimized: false,
  completedSteps: [],
  hasBaby: true,
  hasUpdate: true,
  effectiveSteps: [],
  allDone: true,
  tourBaby: null,
  activeCoachmarkStepId: null,
  restartHintVisible: false,
};

/**
 * Stands in for `convexPreloader` so the real loader runs without a Convex
 * deployment, recording call order to prove the prefetches are not serialised.
 */
/**
 * `Route.update()` is typed for non-structural option tweaks only, so widen it
 * to re-parent the real route (same instance, so its `useLoaderData` keeps
 * resolving) onto a test root.
 */
function reparentRoute<TRoute extends AnyRoute>(
  route: TRoute,
  opts: { path: string; getParentRoute: () => AnyRoute },
): TRoute {
  const update = route.update as (options: typeof opts) => TRoute;
  return update(opts);
}

type EnsureQueryData = (
  query: Parameters<typeof getFunctionName>[0],
  input: Record<string, never>,
) => Promise<{ input: Record<string, never>; initialData: unknown }>;

function stubPreloader(babies: (typeof babySmith)[]) {
  const calls: string[] = [];
  const ensureQueryData = vi.fn<EnsureQueryData>((query, input) => {
    const name = getFunctionName(query);
    calls.push(name);
    return Promise.resolve({
      input,
      initialData: name === getFunctionName(api.baby.listByUser) ? babies : onboardingProgress,
    });
  });
  return { calls, context: { convexPreloader: { ensureQueryData } } };
}

test("shows the empty state once the list has loaded with no babies", async () => {
  await using view = await renderWithTestRouter(
    <DashboardBabyList babies={[]} tourBabyPublicId={undefined} />,
  );

  expect(view.getByText("No baby pages yet")).toBeTruthy();
});

test("dashboard header keeps only add baby and profile settings actions", async () => {
  await using view = await renderWithTestRouter(<DashboardHeader />);

  expect(view.getByRole("button", { name: "Add Baby" }).getAttribute("href")).toBe(
    "/dashboard/add",
  );
  expect(view.getByRole("button", { name: "Settings" }).getAttribute("href")).toBe(
    "/dashboard/settings",
  );
  expect(view.queryByText("Admin")).toBeNull();
  expect(view.queryByText("Log out")).toBeNull();
  expect(view.queryByLabelText("Restart getting started tour")).toBeNull();
});

test("parent dashboard stays mounted while child routes render through its outlet", async () => {
  const preloader = stubPreloader([babySmith]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  // The real route re-parented onto a bare test root: its loader, component,
  // and `<Outlet />` all run, with a child route standing in for /dashboard/*.
  const rootRoute = createRootRoute({
    component: function TestRoot() {
      return (
        <QueryClientProvider client={queryClient}>
          <LocaleProvider locale="en-GB">
            <TooltipProvider>
              <Outlet />
            </TooltipProvider>
          </LocaleProvider>
        </QueryClientProvider>
      );
    },
  });
  const dashboardRoute = reparentRoute(Route, {
    path: "/dashboard",
    getParentRoute: () => rootRoute,
  });
  const childRoute = createRoute({
    getParentRoute: () => dashboardRoute,
    path: "/",
    component: () => <div data-testid="dashboard-outlet" />,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([dashboardRoute.addChildren([childRoute])]),
    history: createMemoryHistory({ initialEntries: ["/dashboard"] }),
    defaultPendingMinMs: 0,
    context: preloader.context,
  });
  await router.load();

  const rendered = render(<RouterProvider router={router} />);
  await using view = makeResource(rendered, () => {
    rendered.unmount();
    queryClient.clear();
  });

  expect(view.getByRole("heading", { name: /Your babies/ })).toBeTruthy();
  expect(view.getByTestId("dashboard-outlet")).toBeTruthy();
});

test("parent dashboard loader starts independent prefetches without a waterfall", async () => {
  const preloader = stubPreloader([]);
  const loader = Route.options.loader as unknown as (opts: {
    context: typeof preloader.context;
  }) => Promise<{ babies: object; onboarding: object }>;

  const pending = loader({ context: preloader.context });

  expect(preloader.calls).toEqual([
    getFunctionName(api.baby.listByUser),
    getFunctionName(api.onboarding.getMine),
  ]);
  await expect(pending).resolves.toMatchObject({
    babies: { initialData: [] },
    onboarding: { initialData: onboardingProgress },
  });
});

test("shows prefetched babies without a spinner", async () => {
  await using view = await renderWithTestRouter(
    <DashboardBabyList tourBabyPublicId="baby-smith" babies={[babySmith]} />,
  );

  expect(view.queryByRole("status", { name: "Loading" })).toBeNull();
  expect(view.queryByText("No babies added yet")).toBeNull();
  expect(view.getByText("Baby Smith")).toBeTruthy();
  expect(view.container.querySelector('[data-tour-id="tour_baby"]')).toBeTruthy();
});
