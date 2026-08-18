import { render } from "@testing-library/react";
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

const plannedBaby: BabyData = {
  name: "Nova",
  dueDate: "2026-09-01",
  birthJourney: "planned_c_section",
  laborStarted: null,
  wentToHospital: null,
  babyBorn: null,
};

test("planned C-section status counts down without labour copy", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-13T12:00:00.000Z"));
  const view = render(
    <StatusDisplay
      baby={plannedBaby}
      currentStatus={getCurrentStatus(plannedBaby)}
      photoUrl={null}
      thumbnailUrl={null}
      latestUpdate={null}
    />,
  );
  await using _view = makeResource(view, () => {
    view.unmount();
  });

  expect(view.getByRole("heading", { name: "The big day is planned" })).toBeTruthy();
  expect(view.getByText("Counting down to the big day")).toBeTruthy();
  expect(view.getByText("19 days to go")).toBeTruthy();
  expect(view.getByText("Planned date: 1 September 2026")).toBeTruthy();
  expect(view.queryByText(/c-section/i)).toBeNull();
  expect(view.queryByText(/labour/i)).toBeNull();
});

test("planned C-section hospital stage announces the big day", () => {
  const atHospital: BabyData = {
    ...plannedBaby,
    wentToHospital: "2026-08-20T07:00:00.000Z",
  };
  const view = render(
    <StatusDisplay
      baby={atHospital}
      currentStatus={getCurrentStatus(atHospital)}
      photoUrl={null}
      thumbnailUrl={null}
      latestUpdate={null}
    />,
  );
  using _view = makeResource(view, () => {
    view.unmount();
  });

  expect(view.getByRole("heading", { name: "At hospital!" })).toBeTruthy();
  expect(view.getByText("The big day is here")).toBeTruthy();
});
