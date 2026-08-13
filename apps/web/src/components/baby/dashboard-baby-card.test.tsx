import { render } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";

vi.mock("@tanstack/react-router", () => ({
  Link: (props: ComponentProps<"a"> & { to: string | undefined }) => (
    <a href={typeof props.to === "string" ? props.to : "#"}>{props.children}</a>
  ),
}));

const { DashboardBabyCard } = await import("./dashboard-baby-card");

type DashboardBabyCardBaby = ComponentProps<typeof DashboardBabyCard>["baby"];

function useFakeTimersResource(now: Date) {
  vi.useFakeTimers({ now });
  return makeResource({}, () => {
    vi.useRealTimers();
  });
}

function renderResource(ui: ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

const alma: DashboardBabyCardBaby = {
  name: "Alma Simone Petra Darvill",
  publicId: "alma-simone-petra-darvill",
  dueDate: "2025-12-31",
  laborStarted: "2026-01-10T12:00:00.000Z",
  wentToHospital: "2026-01-10T18:00:00.000Z",
  babyBorn: "2026-01-11T04:14:00.000Z",
  role: "owner",
};

test("a born baby with a past due date shows born, not overdue", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-13T12:00:00.000Z"));
  await using view = renderResource(<DashboardBabyCard baby={alma} index={0} />);

  expect(view.getByText("Alma Simone Petra Darvill")).toBeTruthy();
  expect(view.getByText("Baby born")).toBeTruthy();
  expect(view.getByText("Born 11 January 2026")).toBeTruthy();
  expect(view.queryByText(/overdue/i)).toBeNull();
  expect(view.queryByText(/Due /)).toBeNull();
});

test("an unborn baby past the due date still shows overdue", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-13T12:00:00.000Z"));
  const waiting: DashboardBabyCardBaby = {
    name: "Baby Waiting",
    publicId: "baby-waiting",
    dueDate: "2025-12-31",
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    role: "owner",
  };
  await using view = renderResource(<DashboardBabyCard baby={waiting} index={0} />);

  expect(view.getByText("225 days overdue")).toBeTruthy();
  expect(view.getByText("Due 31 December 2025")).toBeTruthy();
  expect(view.queryByText("Baby born")).toBeNull();
});

test("labour in progress beats a past due date", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-13T12:00:00.000Z"));
  const inLabor: DashboardBabyCardBaby = {
    name: "Baby In Labor",
    publicId: "baby-in-labor",
    dueDate: "2025-12-31",
    laborStarted: "2026-08-13T08:00:00.000Z",
    wentToHospital: null,
    babyBorn: null,
    role: "owner",
  };
  await using view = renderResource(<DashboardBabyCard baby={inLabor} index={0} />);

  expect(view.getByText("Labour started")).toBeTruthy();
  expect(view.queryByText(/overdue/i)).toBeNull();
});
