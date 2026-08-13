import { expect, test } from "vitest";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";

const { DashboardBabyList } = await import("@/routes/_auth/dashboard/index");

test("shows a spinner instead of the empty state while the baby list is pending", async () => {
  await using view = await renderWithTestRouter(
    <DashboardBabyList babies={[]} isPending tourBabyPublicId={undefined} />,
  );

  expect(view.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(view.queryByText("No baby pages yet")).toBeNull();
});

test("shows the empty state once the list has loaded with no babies", async () => {
  await using view = await renderWithTestRouter(
    <DashboardBabyList babies={[]} isPending={false} tourBabyPublicId={undefined} />,
  );

  expect(view.queryByRole("status", { name: "Loading" })).toBeNull();
  expect(view.getByText("No baby pages yet")).toBeTruthy();
});

test("shows prefetched babies without a spinner", async () => {
  await using view = await renderWithTestRouter(
    <DashboardBabyList
      isPending={false}
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
  expect(view.queryByText("No baby pages yet")).toBeNull();
  expect(view.getByText("Baby Smith")).toBeTruthy();
  expect(view.container.querySelector('[data-tour-id="tour_baby"]')).toBeTruthy();
});
