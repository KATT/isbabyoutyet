import { fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { BirthJourney, MilestoneRemoveHandler } from "@workspace/convex/src/types";
import { JourneyMilestoneEditor } from "./journey-milestone-editor";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn<(message: string) => void>(),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}));

function renderResource(ui: ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

function renderEditor(opts: {
  birthJourney: BirthJourney;
  laborStarted: string | null;
  wentToHospital: string | null;
  onBirthJourneyChange: (birthJourney: BirthJourney) => void | Promise<void>;
  onMilestoneRemove: MilestoneRemoveHandler | null;
}) {
  return renderResource(
    <JourneyMilestoneEditor
      birthJourney={opts.birthJourney}
      laborStarted={opts.laborStarted}
      wentToHospital={opts.wentToHospital}
      idPrefix="test-journey"
      onBirthJourneyChange={opts.onBirthJourneyChange}
      onMilestoneRemove={opts.onMilestoneRemove}
    />,
  );
}

test("shows the Custom chip when both pre-birth milestones are hidden", async () => {
  const onBirthJourneyChange = vi.fn<(birthJourney: BirthJourney) => void>();

  await using view = renderEditor({
    birthJourney: "custom",
    laborStarted: null,
    wentToHospital: null,
    onBirthJourneyChange,
    onMilestoneRemove: null,
  });

  expect(view.getByRole("button", { name: "Custom" })).toBeTruthy();
  expect(view.getByText("Visitors see: Baby born")).toBeTruthy();
});

test("applies toggle changes immediately when no marked milestones need removal", async () => {
  const onBirthJourneyChange = vi
    .fn<(birthJourney: BirthJourney) => Promise<void>>()
    .mockResolvedValue(undefined);

  await using view = renderEditor({
    birthJourney: "labor",
    laborStarted: null,
    wentToHospital: null,
    onBirthJourneyChange,
    onMilestoneRemove: null,
  });

  fireEvent.click(view.getByRole("switch", { name: "Labour started" }));

  await vi.waitFor(() => {
    expect(onBirthJourneyChange).toHaveBeenCalledWith("planned_c_section");
  });
});

test("cancels milestone removal without saving journey changes", async () => {
  const onBirthJourneyChange = vi
    .fn<(birthJourney: BirthJourney) => Promise<void>>()
    .mockResolvedValue(undefined);
  const onMilestoneRemove = vi.fn<MilestoneRemoveHandler>().mockResolvedValue(undefined);

  await using view = renderEditor({
    birthJourney: "labor",
    laborStarted: "2026-08-10T08:00:00.000Z",
    wentToHospital: null,
    onBirthJourneyChange,
    onMilestoneRemove,
  });

  fireEvent.click(view.getByRole("switch", { name: "Labour started" }));
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));

  expect(onMilestoneRemove).not.toHaveBeenCalled();
  expect(onBirthJourneyChange).not.toHaveBeenCalled();
});

test("warns before removing multiple marked milestones at once", async () => {
  const onBirthJourneyChange = vi
    .fn<(birthJourney: BirthJourney) => Promise<void>>()
    .mockResolvedValue(undefined);
  const onMilestoneRemove = vi.fn<MilestoneRemoveHandler>().mockResolvedValue(undefined);

  await using view = renderEditor({
    birthJourney: "planned_c_section",
    laborStarted: "2026-08-10T08:00:00.000Z",
    wentToHospital: "2026-08-10T12:00:00.000Z",
    onBirthJourneyChange,
    onMilestoneRemove,
  });

  fireEvent.click(view.getByRole("switch", { name: "Gone to hospital" }));
  expect(
    view.getByText(
      "Turning these off will remove the marked milestones from your page. Visitors will no longer see them.",
    ),
  ).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Remove and continue" }));

  await vi.waitFor(() => {
    expect(onMilestoneRemove).toHaveBeenCalledWith("gone_to_hospital");
  });
  await vi.waitFor(() => {
    expect(onBirthJourneyChange).toHaveBeenCalledWith("custom");
  });
});

test("reports a failed journey save from the editor", async () => {
  mocks.toastError.mockReset();
  const onBirthJourneyChange = vi
    .fn<(birthJourney: BirthJourney) => Promise<void>>()
    .mockRejectedValue(new Error("Network error"));

  await using view = renderEditor({
    birthJourney: "labor",
    laborStarted: null,
    wentToHospital: null,
    onBirthJourneyChange,
    onMilestoneRemove: null,
  });

  fireEvent.click(view.getByRole("button", { name: "Home birth" }));

  await vi.waitFor(() => {
    expect(mocks.toastError).toHaveBeenCalledWith("Network error");
  });
});
