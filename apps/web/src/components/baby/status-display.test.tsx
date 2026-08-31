import { expect, test, vi } from "vitest";
import { getCurrentStatus } from "@workspace/convex/src/types";
import type { BabyData } from "@workspace/convex/src/types";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { StatusDisplay } from "./status-display";
import { htmlImage } from "@/test/htmlElement";

function useFakeTimersResource(now: Date) {
  vi.useFakeTimers({ now });
  return makeResource({}, () => {
    vi.useRealTimers();
  });
}

const baby: BabyData = {
  name: "Nova",
  timeZone: "Europe/London",
  dueDate: "2026-09-01",
  dueDateDisplayMode: "exact",
  publicDueDateText: null,
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
  await using view = await renderWithTestRouter(
    <StatusDisplay
      publicId={null}
      baby={currentBaby}
      currentStatus={getCurrentStatus(currentBaby)}
      photoUrl={null}
      thumbnailUrl={null}
      blurDataUrl={null}
      latestUpdate={null}
    />,
  );

  expect(view.getByRole("heading", { name: testCase.heading })).toBeTruthy();
  expect(view.getByText(testCase.subline)).toBeTruthy();
});

test("home-birth labour copy does not mention hospital", async () => {
  const homeBirthBaby: BabyData = {
    ...baby,
    milestoneVisibility: { showLabor: true, showHospital: false },
    laborStarted: "2026-08-18T07:00:00.000Z",
  };
  await using view = await renderWithTestRouter(
    <StatusDisplay
      publicId={null}
      baby={homeBirthBaby}
      currentStatus={getCurrentStatus(homeBirthBaby)}
      photoUrl={null}
      thumbnailUrl={null}
      blurDataUrl={null}
      latestUpdate={null}
    />,
  );

  expect(view.getByText("Things are happening!")).toBeTruthy();
  expect(view.queryByText("Not at hospital yet")).toBeNull();
});

test("shows the latest family message when present", async () => {
  await using view = await renderWithTestRouter(
    <StatusDisplay
      publicId={null}
      baby={baby}
      currentStatus={getCurrentStatus(baby)}
      photoUrl={null}
      thumbnailUrl={null}
      blurDataUrl={null}
      latestUpdate={{ message: "Everything is calm", postedAt: Date.now() }}
    />,
  );

  expect(view.getByText("Everything is calm")).toBeTruthy();
});

test.each([
  { dueDate: "2026-08-17", expected: "1 day overdue" },
  { dueDate: "2026-08-19", expected: "1 day until due date" },
])("renders singular countdown copy: $expected", async (testCase) => {
  await using _timers = useFakeTimersResource(new Date("2026-08-18T08:00:00.000Z"));
  const currentBaby = { ...baby, dueDate: testCase.dueDate };
  await using view = await renderWithTestRouter(
    <StatusDisplay
      publicId={null}
      baby={currentBaby}
      currentStatus={getCurrentStatus(currentBaby)}
      photoUrl={null}
      thumbnailUrl={null}
      blurDataUrl={null}
      latestUpdate={null}
    />,
  );

  expect(view.getByText(testCase.expected)).toBeTruthy();
});

test("custom public due date text replaces the exact date and countdown", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-18T08:00:00.000Z"));
  await using view = await renderWithTestRouter(
    <StatusDisplay
      publicId={null}
      baby={{
        ...baby,
        dueDate: null,
        dueDateDisplayMode: "message",
        publicDueDateText: "Any day now",
      }}
      currentStatus={getCurrentStatus(baby)}
      photoUrl={null}
      thumbnailUrl={null}
      blurDataUrl={null}
      latestUpdate={null}
    />,
  );

  expect(view.getByText("Any day now")).toBeTruthy();
  expect(view.queryByText(/until due date/)).toBeNull();
  expect(view.queryByText(/19 September/)).toBeNull();
});

test("hides the due date box when message mode has no public text", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-18T08:00:00.000Z"));
  await using view = await renderWithTestRouter(
    <StatusDisplay
      publicId={null}
      baby={{
        ...baby,
        dueDate: null,
        dueDateDisplayMode: "message",
        publicDueDateText: null,
      }}
      currentStatus={getCurrentStatus(baby)}
      photoUrl={null}
      thumbnailUrl={null}
      blurDataUrl={null}
      latestUpdate={null}
    />,
  );

  expect(view.queryByText(/until due date/)).toBeNull();
  expect(view.queryByText(/Due date:/)).toBeNull();
  expect(view.getByText("Not yet")).toBeTruthy();
});

test("blank public due date text keeps the exact date and countdown", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-18T08:00:00.000Z"));
  await using view = await renderWithTestRouter(
    <StatusDisplay
      publicId={null}
      baby={{ ...baby, publicDueDateText: "   " }}
      currentStatus={getCurrentStatus(baby)}
      photoUrl={null}
      thumbnailUrl={null}
      blurDataUrl={null}
      latestUpdate={null}
    />,
  );

  expect(view.getByText("14 days until due date")).toBeTruthy();
  expect(view.getByText("Due date: 1 September 2026")).toBeTruthy();
});

test("uses the thumbnail inline and links to the photo overlay", async () => {
  await using view = await renderWithTestRouter(
    <StatusDisplay
      publicId="baby-nova"
      baby={baby}
      currentStatus={getCurrentStatus(baby)}
      photoUrl="https://example.com/full.jpg"
      thumbnailUrl="https://example.com/thumb.jpg"
      blurDataUrl="data:image/jpeg;base64,abc"
      latestUpdate={null}
    />,
  );

  const avatar = view.getByRole("link", { name: "Photo of Nova" });
  expect(avatar.getAttribute("href")).toBe("/baby/baby-nova/photo");
  const inline = htmlImage(view.getByAltText("Photo of Nova"));
  expect(inline.src).toContain("thumb.jpg");
  expect(
    inline.parentElement?.querySelector<HTMLImageElement>("[data-blur-image-placeholder]")?.src,
  ).toContain("data:image/jpeg;base64,abc");
});
