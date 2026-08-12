import { fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { SettingsPanel } from "./settings-panel";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => vi.fn()),
}));
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { BabyData } from "@workspace/convex/src/types";

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

test("renders nothing while closed", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  await using view = renderResource(
    <SettingsPanel baby={makeBaby({})} onUpdate={vi.fn()} isOpen={false} />,
  );

  expect(view.queryByText("Baby Name")).toBeNull();
});

test("renders every settings row (without photo in preview mode)", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  const baby = makeBaby({ laborStarted: "2026-08-11T08:00:00.000Z" });
  await using view = renderResource(<SettingsPanel baby={baby} onUpdate={vi.fn()} isOpen />);

  expect(view.getByText("Baby Name")).toBeTruthy();
  expect(view.getByText("Baby Smith")).toBeTruthy();
  expect(view.getByText("Due Date")).toBeTruthy();
  expect(view.getByText("September 1, 2026")).toBeTruthy();
  expect(view.getAllByText("Labour started").length).toBeGreaterThan(0);
  // laborStarted is set, so its row shows the relative timestamp
  expect(view.getByText(/4 hours ago/)).toBeTruthy();
  expect(view.getByText("Labour Message")).toBeTruthy();
  expect(view.getAllByText("Gone to hospital").length).toBeGreaterThan(0);
  expect(view.getByText("Hospital Message")).toBeTruthy();
  expect(view.getAllByText("Baby born").length).toBeGreaterThan(0);
  expect(view.getByText("Baby Born Message")).toBeTruthy();
  expect(view.getAllByText("Default message")).toHaveLength(3);
  expect(view.getByText("Theme")).toBeTruthy();
  expect(view.getByText("Encouragements")).toBeTruthy();

  // No babyId (preview mode) -> no photo row
  expect(view.queryByText("Baby Photo")).toBeNull();
});

test("renders a fully-populated baby including the photo row", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  const baby = makeBaby({
    laborStarted: "2026-08-10T20:00:00.000Z",
    wentToHospital: "2026-08-10T23:00:00.000Z",
    babyBorn: "2026-08-11T09:00:00.000Z",
    hospitalMessage: "On our way",
    babyBornMessage: "She is here",
    laborStartedMessage: "It begins",
    theme: "twitter",
    encouragementsDisabled: true,
  });
  await using view = renderResource(
    <SettingsPanel
      baby={baby}
      babyId={"baby-1" as never}
      photoUrl="https://example.com/photo.jpg"
      onUpdate={vi.fn()}
      isOpen
    />,
  );

  expect(view.getByText("Baby Photo")).toBeTruthy();
  expect(view.getByText("Photo uploaded")).toBeTruthy();
  expect(view.getByAltText("Baby")).toBeTruthy();
  expect(view.getByText("Twitter Blue")).toBeTruthy();
  expect(view.getByText("Form disabled")).toBeTruthy();
  expect(view.getByText("On our way")).toBeTruthy();
  expect(view.getByText("She is here")).toBeTruthy();
  expect(view.getByText("It begins")).toBeTruthy();
  // All three status rows show their date editors when a date is set
  expect(view.getAllByText(/ago\)/).length).toBeGreaterThanOrEqual(3);
});

test("shows 'No photo' when a babyId is set but no photo exists", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  await using view = renderResource(
    <SettingsPanel baby={makeBaby({})} babyId={"baby-1" as never} onUpdate={vi.fn()} isOpen />,
  );

  expect(view.getByText("No photo")).toBeTruthy();
});

test("toggling encouragements calls onUpdate", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  const onUpdate = vi.fn();
  await using view = renderResource(
    <SettingsPanel baby={makeBaby({})} onUpdate={onUpdate} isOpen />,
  );

  expect(view.getByText("Visitors can send messages")).toBeTruthy();

  fireEvent.click(view.getByRole("switch"));
  expect(onUpdate).toHaveBeenCalledWith({ encouragementsDisabled: true });
});
