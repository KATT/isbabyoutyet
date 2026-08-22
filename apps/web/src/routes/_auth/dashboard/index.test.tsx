import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";

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
  createFileRoute: () => (opts: { component: unknown }) => opts,
  getRouteApi: () => ({
    useRouteContext: () => ({
      profile: {
        input: {},
        initialData: { locale: "en-GB", timeZone: "Europe/London", isAdmin: false },
      },
    }),
  }),
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

const { DashboardBabyList, DashboardHeader } = await import("@/routes/_auth/dashboard/index");

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
