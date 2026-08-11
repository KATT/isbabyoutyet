import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { ProgressIndicator } from "./progress-indicator";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { BabyData } from "@workspace/convex/src/types";
import { getCurrentStatus } from "@workspace/convex/src/types";

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

function makeBaby(overrides: Partial<BabyData>): BabyData {
  return {
    name: "Baby Smith",
    dueDate: "2026-09-01",
    theme: null,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    hospitalMessage: null,
    babyBornMessage: null,
    laborStartedMessage: null,
    encouragementsDisabled: false,
    photoId: null,
    thumbnailId: null,
    ...overrides,
  };
}

function renderProgressIndicator(baby: BabyData) {
  return renderResource(<ProgressIndicator baby={baby} currentStatus={getCurrentStatus(baby)} />);
}

test("shows all steps without timestamps before anything happened", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  await using view = renderProgressIndicator(makeBaby({}));

  expect(view.getByText("Labour started")).toBeTruthy();
  expect(view.getByText("Gone to hospital")).toBeTruthy();
  expect(view.getByText("Baby born")).toBeTruthy();
  expect(view.queryByText(/ago/)).toBeNull();
});

test("shows a timestamp only for steps that happened", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  await using view = renderProgressIndicator(
    makeBaby({ laborStarted: "2026-08-11T08:00:00.000Z" }),
  );

  expect(view.getByText(/4 hours ago/)).toBeTruthy();
  expect(view.queryByText(/2 days ago/)).toBeNull();
});

test("shows timestamps for every step once the baby is born", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  await using view = renderProgressIndicator(
    makeBaby({
      laborStarted: "2026-08-09T12:00:00.000Z",
      wentToHospital: "2026-08-10T12:00:00.000Z",
      babyBorn: "2026-08-11T09:00:00.000Z",
    }),
  );

  expect(view.getByText(/2 days ago/)).toBeTruthy();
  expect(view.getByText(/yesterday/)).toBeTruthy();
  expect(view.getByText(/3 hours ago/)).toBeTruthy();
});
