import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { getCurrentStatus } from "@workspace/convex/src/types";
import type { BabyData } from "@workspace/convex/src/types";
import { makeResource } from "@workspace/convex/convex/test.resource";

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    history: {
      location: { state: { overlay: undefined } },
      canGoBack: () => false,
      back: vi.fn<() => void>(),
    },
    navigate: vi.fn<() => Promise<void>>(async () => {}),
  }),
  Link: (
    props: React.ComponentProps<"a"> & {
      to: string | undefined;
      params: { publicId: string } | undefined;
    },
  ) => {
    const href =
      typeof props.to === "string"
        ? props.to.replace("$publicId", props.params?.publicId ?? "")
        : "#";
    return (
      <a href={href} aria-label={props["aria-label"]} className={props.className}>
        {props.children}
      </a>
    );
  },
}));

const { StatusDisplay } = await import("./status-display");

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
  const view = render(
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
  await using _view = makeResource(view, () => {
    view.unmount();
  });

  expect(view.getByRole("heading", { name: testCase.heading })).toBeTruthy();
  expect(view.getByText(testCase.subline)).toBeTruthy();
});

test("home-birth labour copy does not mention hospital", () => {
  const homeBirthBaby: BabyData = {
    ...baby,
    milestoneVisibility: { showLabor: true, showHospital: false },
    laborStarted: "2026-08-18T07:00:00.000Z",
  };
  const view = render(
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
  using _view = makeResource(view, () => {
    view.unmount();
  });

  expect(view.getByText("Things are happening!")).toBeTruthy();
  expect(view.queryByText("Not at hospital yet")).toBeNull();
});

test("shows the latest family message when present", () => {
  const view = render(
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
      publicId={null}
      baby={currentBaby}
      currentStatus={getCurrentStatus(currentBaby)}
      photoUrl={null}
      thumbnailUrl={null}
      blurDataUrl={null}
      latestUpdate={null}
    />,
  );
  await using _view = makeResource(view, () => {
    view.unmount();
  });

  expect(view.getByText(testCase.expected)).toBeTruthy();
});

test("custom public due date text replaces the exact date and countdown", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-18T08:00:00.000Z"));
  const view = render(
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
  await using _view = makeResource(view, () => {
    view.unmount();
  });

  expect(view.getByText("Any day now")).toBeTruthy();
  expect(view.queryByText(/until due date/)).toBeNull();
  expect(view.queryByText(/19 September/)).toBeNull();
});

test("hides the due date box when message mode has no public text", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-18T08:00:00.000Z"));
  const view = render(
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
  await using _view = makeResource(view, () => {
    view.unmount();
  });

  expect(view.queryByText(/until due date/)).toBeNull();
  expect(view.queryByText(/Due date:/)).toBeNull();
  expect(view.getByText("Not yet")).toBeTruthy();
});

test("blank public due date text keeps the exact date and countdown", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-18T08:00:00.000Z"));
  const view = render(
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
  await using _view = makeResource(view, () => {
    view.unmount();
  });

  expect(view.getByText("14 days until due date")).toBeTruthy();
  expect(view.getByText("Due date: 1 September 2026")).toBeTruthy();
});

test("uses the thumbnail inline and links to the photo overlay", () => {
  const view = render(
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
  using _view = makeResource(view, () => {
    view.unmount();
  });

  const avatar = view.getByRole("link", { name: "Photo of Nova" });
  expect(avatar.getAttribute("href")).toBe("/baby/baby-nova/photo");
  const inline = view.getByAltText("Photo of Nova") as HTMLImageElement;
  expect(inline.src).toContain("thumb.jpg");
  expect(
    inline.parentElement?.querySelector<HTMLImageElement>("[data-blur-image-placeholder]")?.src,
  ).toContain("data:image/jpeg;base64,abc");
});
