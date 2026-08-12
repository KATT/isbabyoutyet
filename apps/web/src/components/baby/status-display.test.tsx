import { fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { StatusDisplay } from "./status-display";
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

function renderStatusDisplay(baby: BabyData, photoUrl?: string | null) {
  return renderResource(
    <StatusDisplay baby={baby} currentStatus={getCurrentStatus(baby)} photoUrl={photoUrl} />,
  );
}

test("shows overdue days when the due date has passed", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  const baby = makeBaby({ dueDate: "2026-08-01" });
  await using view = renderStatusDisplay(baby);

  expect(view.getByText("Not yet")).toBeTruthy();
  expect(view.getByText("10 days overdue")).toBeTruthy();
  expect(view.getByText("Due date: August 1, 2026")).toBeTruthy();
});

test("shows labor started status with the custom message", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  const baby = makeBaby({
    laborStarted: "2026-08-11T08:00:00.000Z",
    laborStartedMessage: "Hang in there!",
  });
  await using view = renderStatusDisplay(baby);

  expect(view.getByText("Labour started")).toBeTruthy();
  expect(view.getByText("Not gone to hospital yet")).toBeTruthy();
  expect(view.getByText(/4 hours ago/)).toBeTruthy();
  expect(view.getByText("Hang in there!")).toBeTruthy();
});

test("shows gone to hospital status with the custom message", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  const baby = makeBaby({
    laborStarted: "2026-08-11T06:00:00.000Z",
    wentToHospital: "2026-08-11T10:00:00.000Z",
    hospitalMessage: "On our way!",
  });
  await using view = renderStatusDisplay(baby);

  expect(view.getByText("Gone to hospital")).toBeTruthy();
  expect(view.getByText(/2 hours ago/)).toBeTruthy();
  expect(view.getByText("On our way!")).toBeTruthy();
});

test("shows born status with message and photo avatar", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  const baby = makeBaby({
    laborStarted: "2026-08-10T20:00:00.000Z",
    wentToHospital: "2026-08-10T23:00:00.000Z",
    babyBorn: "2026-08-11T09:00:00.000Z",
    babyBornMessage: "Everyone is doing great",
  });
  await using view = renderStatusDisplay(baby, "https://example.com/photo.jpg");

  expect(view.getByText("Yes! Baby is out")).toBeTruthy();
  expect(view.getByText(/Born on/)).toBeTruthy();
  expect(view.getByText(/3 hours ago/)).toBeTruthy();
  expect(view.getByText("Everyone is doing great")).toBeTruthy();
  expect(view.getAllByAltText("Baby").length).toBeGreaterThan(0);
});

test("clicking the photo avatar opens the full-size photo dialog", async () => {
  const baby = makeBaby({ babyBorn: "2026-08-11T09:00:00.000Z" });
  await using view = renderStatusDisplay(baby, "https://example.com/photo.jpg");

  const avatarButton = view.getAllByRole("button")[0];
  fireEvent.click(avatarButton);

  // Dialog shows the full-size photo with a close button
  await vi.waitFor(() => {
    const images = document.body.querySelectorAll('img[src="https://example.com/photo.jpg"]');
    expect(images.length).toBeGreaterThanOrEqual(2);
  });

  // The close button dismisses the dialog again
  const closeIcon = document.body.querySelector("svg.lucide-x");
  const closeButton = closeIcon?.closest("button");
  if (!closeButton) throw new Error("close button not found");
  fireEvent.click(closeButton);
  await vi.waitFor(() => {
    const images = document.body.querySelectorAll('img[src="https://example.com/photo.jpg"]');
    expect(images.length).toBe(1);
  });
});
