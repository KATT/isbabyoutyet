import type { ComponentProps } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { DashboardBabyCard } from "./dashboard-baby-card";

type DashboardBabyCardBaby = ComponentProps<typeof DashboardBabyCard>["baby"];

function useFakeTimersResource(now: Date) {
  vi.useFakeTimers({ now });
  return makeResource({}, () => {
    vi.useRealTimers();
  });
}

const alma: DashboardBabyCardBaby = {
  name: "Alma Simone Petra Darvill",
  timeZone: "Europe/London",
  publicId: "alma-simone-petra-darvill",
  dueDate: "2025-12-31",
  dueDateDisplayMode: "exact",
  publicDueDateText: null,
  laborStarted: "2026-01-10T12:00:00.000Z",
  wentToHospital: "2026-01-10T18:00:00.000Z",
  babyBorn: "2026-01-11T04:14:00.000Z",
  birthJourney: "labor" as const,
  role: "owner",
};

test("a born baby with a past due date shows born, not overdue", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-13T12:00:00.000Z"));
  await using view = await renderWithTestRouter(
    <DashboardBabyCard baby={alma} index={0} dataTourId={undefined} />,
  );

  expect(view.getByText("Alma Simone Petra Darvill")).toBeTruthy();
  expect(view.getByText("Baby born")).toBeTruthy();
  expect(view.getByText("Born 11 January 2026")).toBeTruthy();
  expect(view.queryByText(/overdue/i)).toBeNull();
  expect(view.queryByText(/Due /)).toBeNull();
});

test("an unborn baby past the due date still shows overdue", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-13T12:00:00.000Z"));
  const waiting: DashboardBabyCardBaby = {
    name: "Avery",
    timeZone: "Europe/London",
    publicId: "baby-waiting",
    dueDate: "2025-12-31",
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    birthJourney: "labor" as const,
    role: "owner",
  };
  await using view = await renderWithTestRouter(
    <DashboardBabyCard baby={waiting} index={0} dataTourId={undefined} />,
  );

  expect(view.getByText("225 days overdue")).toBeTruthy();
  expect(view.getByText("Due 31 December 2025")).toBeTruthy();
  expect(view.queryByText("Baby born")).toBeNull();
});

test("labour in progress beats a past due date", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-13T12:00:00.000Z"));
  const inLabor: DashboardBabyCardBaby = {
    name: "Frankie",
    timeZone: "Europe/London",
    publicId: "baby-in-labor",
    dueDate: "2025-12-31",
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
    laborStarted: "2026-08-13T08:00:00.000Z",
    wentToHospital: null,
    babyBorn: null,
    birthJourney: "labor" as const,
    role: "owner",
  };
  await using view = await renderWithTestRouter(
    <DashboardBabyCard baby={inLabor} index={0} dataTourId={undefined} />,
  );

  expect(view.getByText("Labour started")).toBeTruthy();
  expect(view.queryByText(/overdue/i)).toBeNull();
});

test("marks the tour baby card for coachmarks", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-13T12:00:00.000Z"));
  await using view = await renderWithTestRouter(
    <DashboardBabyCard baby={alma} index={1} dataTourId="tour_baby" />,
  );

  expect(view.container.querySelector('[data-tour-id="tour_baby"]')).toBeTruthy();
});

test("an unborn baby before the due date shows days remaining", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-13T12:00:00.000Z"));
  const waiting: DashboardBabyCardBaby = {
    name: "Avery",
    timeZone: "Europe/London",
    publicId: "baby-waiting",
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    birthJourney: "labor" as const,
    role: "coParent",
  };
  await using view = await renderWithTestRouter(
    <DashboardBabyCard baby={waiting} index={0} dataTourId={undefined} />,
  );

  expect(view.getByText("Shared with you")).toBeTruthy();
  expect(view.getByText("19 days until due date")).toBeTruthy();
});

test("a message-mode baby card does not show a due date", async () => {
  const waiting: DashboardBabyCardBaby = {
    name: "Avery",
    timeZone: "Europe/London",
    publicId: "baby-waiting",
    dueDate: null,
    dueDateDisplayMode: "message",
    publicDueDateText: "Any day now",
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    birthJourney: "labor" as const,
    role: "owner",
  };
  await using view = await renderWithTestRouter(
    <DashboardBabyCard baby={waiting} index={0} dataTourId={undefined} />,
  );

  expect(view.getByText("Any day now")).toBeTruthy();
  expect(view.getByText("Not yet")).toBeTruthy();
  expect(view.queryByText(/Due /)).toBeNull();
});

test("a message-mode baby card with no text shows a hidden label", async () => {
  const waiting: DashboardBabyCardBaby = {
    name: "Avery",
    timeZone: "Europe/London",
    publicId: "baby-waiting",
    dueDate: "2026-09-01",
    dueDateDisplayMode: "message",
    publicDueDateText: null,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    birthJourney: "labor" as const,
    role: "owner",
  };
  await using view = await renderWithTestRouter(
    <DashboardBabyCard baby={waiting} index={0} dataTourId={undefined} />,
  );

  expect(view.getByText("Due date hidden")).toBeTruthy();
  expect(view.queryByText(/Due 1 September/)).toBeNull();
});

test("gone to hospital beats a past due date", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-13T12:00:00.000Z"));
  const atHospital: DashboardBabyCardBaby = {
    name: "Rowan",
    timeZone: "Europe/London",
    publicId: "baby-at-hospital",
    dueDate: "2025-12-31",
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
    laborStarted: "2026-08-13T08:00:00.000Z",
    wentToHospital: "2026-08-13T10:00:00.000Z",
    babyBorn: null,
    birthJourney: "labor" as const,
    role: "owner",
  };
  await using view = await renderWithTestRouter(
    <DashboardBabyCard baby={atHospital} index={0} dataTourId={undefined} />,
  );

  expect(view.getByText("Gone to hospital")).toBeTruthy();
  expect(view.queryByText(/overdue/i)).toBeNull();
  expect(view.queryByText("Baby born")).toBeNull();
});

test("an unborn baby due today shows due today", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-13T12:00:00.000Z"));
  const dueToday: DashboardBabyCardBaby = {
    name: "Sage",
    timeZone: "Europe/London",
    publicId: "baby-due-today",
    dueDate: "2026-08-13",
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    birthJourney: "labor" as const,
    role: "owner",
  };
  await using view = await renderWithTestRouter(
    <DashboardBabyCard baby={dueToday} index={0} dataTourId={undefined} />,
  );

  expect(view.getByText("Due today!")).toBeTruthy();
  expect(view.getByText("Due 13 August 2026")).toBeTruthy();
});

test("an exact-mode baby without a due date shows not yet", async () => {
  const waiting: DashboardBabyCardBaby = {
    name: "Avery",
    timeZone: "Europe/London",
    publicId: "baby-waiting",
    dueDate: null,
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    birthJourney: "labor" as const,
    role: "owner",
  };
  await using view = await renderWithTestRouter(
    <DashboardBabyCard baby={waiting} index={0} dataTourId={undefined} />,
  );

  expect(view.getByText("Not yet")).toBeTruthy();
});
