import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";

const mocks = vi.hoisted(() => ({
  babies: { kind: "babies" },
  onboarding: { kind: "onboarding" },
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    history: {
      location: { state: { overlay: undefined } },
      canGoBack: () => false,
      back: vi.fn<() => void>(),
    },
    navigate: vi.fn<() => Promise<void>>(async () => {}),
  }),
  Link: (props: React.ComponentProps<"a"> & { to: string | undefined }) => (
    <a href={typeof props.to === "string" ? props.to : "#"} {...props} />
  ),
  Outlet: () => <div data-testid="dashboard-outlet" />,
  createFileRoute: () => (opts: { component: unknown; loader: unknown }) => ({
    ...opts,
    options: opts,
    useLoaderData: () => ({
      babies: mocks.babies,
      onboarding: mocks.onboarding,
    }),
  }),
  getRouteApi: () => ({
    useRouteContext: () => ({
      profile: {
        input: {},
        initialData: { locale: "en-GB", timeZone: "Europe/London", isAdmin: false },
      },
    }),
  }),
}));

vi.mock("@workspace/convex-prefetch", () => ({
  usePreloadedConvexQuery: (_query: unknown, handle: unknown) =>
    handle === mocks.babies
      ? { data: [] }
      : {
          data: { tourBaby: null },
        },
}));

vi.mock("@/components/onboarding/onboarding-host", () => ({
  OnboardingHost: () => null,
}));

vi.mock("@/components/language-settings", () => ({
  LanguageSettings: () => null,
}));

vi.mock("@/lib/auth-server", () => ({
  authServer: {
    fetchAuthQuery: vi.fn<() => Promise<unknown>>(),
    getToken: vi.fn<() => Promise<string | null>>(),
  },
}));

const routeModule = await import("@/routes/_auth/dashboard/route");
const { DashboardBabyList, DashboardHeader, DashboardPageLayout } = routeModule;

function renderResource(ui: ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("shows the empty state once the list has loaded with no babies", async () => {
  await using view = renderResource(<DashboardBabyList babies={[]} tourBabyPublicId={undefined} />);

  expect(view.getByText("No baby pages yet")).toBeTruthy();
});

test("dashboard header keeps only add baby and profile settings actions", async () => {
  await using view = renderResource(<DashboardHeader />);

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
  await using view = renderResource(<DashboardPageLayout />);

  expect(view.getByRole("heading", { name: /Your babies/ })).toBeTruthy();
  expect(view.getByTestId("dashboard-outlet")).toBeTruthy();
});

test("parent dashboard loader starts independent prefetches without a waterfall", async () => {
  const calls: string[] = [];
  const ensureQueryData = vi.fn<
    (_query: unknown, _input: unknown) => Promise<Record<string, never>>
  >(() => {
    calls.push(`query-${String(calls.length + 1)}`);
    return Promise.resolve({});
  });
  const loader = routeModule.Route.options.loader as unknown as (opts: {
    context: { convexPreloader: { ensureQueryData: typeof ensureQueryData } };
  }) => Promise<unknown>;

  const pending = loader({
    context: {
      convexPreloader: { ensureQueryData },
    },
  });

  expect(calls).toEqual(["query-1", "query-2"]);
  await expect(pending).resolves.toMatchObject({
    babies: {},
    onboarding: {},
  });
});

test("shows prefetched babies without a spinner", async () => {
  await using view = renderResource(
    <DashboardBabyList
      tourBabyPublicId="baby-smith"
      babies={[
        {
          _id: "baby-id" as Id<"baby">,
          name: "Baby Smith",
          timeZone: "Europe/London",
          publicId: "baby-smith",
          dueDate: "2026-12-01",
          dueDateDisplayMode: "exact",
          publicDueDateText: null,
          laborStarted: null,
          wentToHospital: null,
          babyBorn: null,
          role: "owner",
        },
      ]}
    />,
  );

  expect(view.queryByRole("status", { name: "Loading" })).toBeNull();
  expect(view.queryByText("No babies added yet")).toBeNull();
  expect(view.getByText("Baby Smith")).toBeTruthy();
  expect(view.container.querySelector('[data-tour-id="tour_baby"]')).toBeTruthy();
});
