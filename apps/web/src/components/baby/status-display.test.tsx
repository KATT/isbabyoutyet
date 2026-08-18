import { fireEvent, render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { StatusDisplay } from "./status-display";
import { getCurrentStatus } from "@workspace/convex/src/types";
import type { BabyData } from "@workspace/convex/src/types";
import { makeResource } from "@workspace/convex/convex/test.resource";

function useFakeTimersResource(now: Date) {
  vi.useFakeTimers({ now });
  return makeResource({}, () => {
    vi.useRealTimers();
  });
}

const baby: BabyData = {
  name: "Nova",
  dueDate: "2026-09-01",
  milestoneVisibility: { showLabor: true, showHospital: true },
  laborStarted: null,
  wentToHospital: null,
  babyBorn: null,
};

test.each([
  {
    dates: { laborStarted: "2026-08-18T07:00:00.000Z" },
    heading: "Labour started!",
    subline: "Not at hospital yet",
  },
  {
    dates: { wentToHospital: "2026-08-18T07:00:00.000Z" },
    heading: "Gone to hospital!",
    subline: "Almost there now",
  },
  {
    dates: { babyBorn: "2026-08-18T07:00:00.000Z" },
    heading: "Yes! Baby is out",
    subline: "Welcome to the world, little one",
  },
])("renders the $heading status selected by the journey", async (testCase) => {
  await using _timers = useFakeTimersResource(new Date("2026-08-18T08:00:00.000Z"));
  const currentBaby = { ...baby, ...testCase.dates };
  const view = render(
    <StatusDisplay
      baby={currentBaby}
      currentStatus={getCurrentStatus(currentBaby)}
      photoUrl={null}
      thumbnailUrl={null}
      latestUpdate={null}
    />,
  );
  await using _view = makeResource(view, () => {
    view.unmount();
  });

  expect(view.getByRole("heading", { name: testCase.heading })).toBeTruthy();
  expect(view.getByText(testCase.subline)).toBeTruthy();
});

test("shows the latest family message when present", () => {
  const view = render(
    <StatusDisplay
      baby={baby}
      currentStatus={getCurrentStatus(baby)}
      photoUrl={null}
      thumbnailUrl={null}
      latestUpdate={{ message: "Everything is calm", postedAt: Date.now() }}
    />,
  );
  using _view = makeResource(view, () => {
    view.unmount();
  });

  expect(view.getByText("Everything is calm")).toBeTruthy();
});

test.each([
  { dueDate: "2026-08-17", expected: "1 day overdue" },
  { dueDate: "2026-08-19", expected: "1 day until due date" },
])("renders singular countdown copy: $expected", async (testCase) => {
  await using _timers = useFakeTimersResource(new Date("2026-08-18T08:00:00.000Z"));
  const currentBaby = { ...baby, dueDate: testCase.dueDate };
  const view = render(
    <StatusDisplay
      baby={currentBaby}
      currentStatus={getCurrentStatus(currentBaby)}
      photoUrl={null}
      thumbnailUrl={null}
      latestUpdate={null}
    />,
  );
  await using _view = makeResource(view, () => {
    view.unmount();
  });

  expect(view.getByText(testCase.expected)).toBeTruthy();
});

test("uses the thumbnail inline and opens the full photo", () => {
  const view = render(
    <StatusDisplay
      baby={baby}
      currentStatus={getCurrentStatus(baby)}
      photoUrl="https://example.com/full.jpg"
      thumbnailUrl="https://example.com/thumb.jpg"
      latestUpdate={null}
    />,
  );
  using _view = makeResource(view, () => {
    view.unmount();
  });

  const avatar = view.getByRole("button", { name: "Photo of Nova" });
  expect((view.getByAltText("Photo of Nova") as HTMLImageElement).src).toContain("thumb.jpg");
  fireEvent.click(avatar);
  expect(view.getAllByAltText("Photo of Nova")).toHaveLength(2);
  fireEvent.click(view.getByRole("button", { name: "Close photo" }));
});
