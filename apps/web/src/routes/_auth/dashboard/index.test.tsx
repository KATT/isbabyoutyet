import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";

vi.mock("@tanstack/react-router", () => ({
  Link: (props: React.ComponentProps<"a"> & { to?: string }) => (
    <a href={typeof props.to === "string" ? props.to : "#"} {...props} />
  ),
  createFileRoute: () => (opts: { component: unknown }) => opts,
}));

vi.mock("@/components/language-settings", () => ({
  LanguageSettings: () => null,
}));

vi.mock("@/lib/auth-server", () => ({
  authServer: { fetchAuthQuery: vi.fn<() => Promise<unknown>>() },
}));

const { DashboardBabyList } = await import("@/routes/_auth/dashboard/index");

function renderResource(ui: ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("shows a spinner instead of the empty state while the baby list is pending", async () => {
  await using view = renderResource(<DashboardBabyList babies={[]} isPending />);

  expect(view.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(view.queryByText("No babies added yet")).toBeNull();
});

test("shows the empty state once the list has loaded with no babies", async () => {
  await using view = renderResource(<DashboardBabyList babies={[]} isPending={false} />);

  expect(view.queryByRole("status", { name: "Loading" })).toBeNull();
  expect(view.getByText("No babies added yet")).toBeTruthy();
});

test("shows prefetched babies without a spinner", async () => {
  await using view = renderResource(
    <DashboardBabyList
      isPending={false}
      babies={[
        {
          _id: "baby-id" as Id<"baby">,
          name: "Baby Smith",
          publicId: "baby-smith",
          dueDate: "2026-12-01",
          role: "owner",
        },
      ]}
    />,
  );

  expect(view.queryByRole("status", { name: "Loading" })).toBeNull();
  expect(view.queryByText("No babies added yet")).toBeNull();
  expect(view.getByText("Baby Smith")).toBeTruthy();
});
