import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";

vi.mock("@tanstack/react-router", () => ({
  Link: (props: React.ComponentProps<"a"> & { to: string | undefined }) => (
    <a href={typeof props.to === "string" ? props.to : "#"} {...props} />
  ),
  createFileRoute: () => (opts: { component: unknown }) => opts,
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

const { DashboardBabyList } = await import("@/routes/_auth/dashboard/index");

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

test("shows prefetched babies without a spinner", async () => {
  await using view = renderResource(
    <DashboardBabyList
      tourBabyPublicId="baby-smith"
      babies={[
        {
          _id: "baby-id" as Id<"baby">,
          name: "Baby Smith",
          publicId: "baby-smith",
          dueDate: "2026-12-01",
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

test("client navigations return initiated handles without awaiting any data", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn: () => Promise.resolve(null) },
    },
  });

  const { Route } = await import("@/routes/_auth/dashboard/index");
  const options = Route as unknown as {
    loader: (opts: { context: { queryClient: unknown } }) => Promise<Record<string, unknown>>;
  };
  const result = await options.loader({ context: { queryClient } });

  // Initiated handles carry only the query input — data streams in via suspense.
  expect(result).toEqual({
    babies: { input: {} },
    onboarding: { input: {} },
    profile: { input: {} },
  });
});
