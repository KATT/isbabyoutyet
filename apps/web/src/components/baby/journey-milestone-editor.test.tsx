import { fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { BirthJourney } from "@workspace/convex/src/types";
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
  onBirthJourneyChange: (birthJourney: BirthJourney) => void | Promise<void>;
}) {
  return renderResource(
    <JourneyMilestoneEditor
      birthJourney={opts.birthJourney}
      idPrefix="test-journey"
      onBirthJourneyChange={opts.onBirthJourneyChange}
    />,
  );
}

test("shows the Custom chip when both pre-birth milestones are hidden", async () => {
  const onBirthJourneyChange = vi.fn<(birthJourney: BirthJourney) => void>();

  await using view = renderEditor({
    birthJourney: "custom",
    onBirthJourneyChange,
  });

  expect(view.getByRole("button", { name: "Custom" })).toBeTruthy();
  expect(view.getByText("Visitors see: Baby born")).toBeTruthy();
});

test("applies toggle changes immediately", async () => {
  const onBirthJourneyChange = vi
    .fn<(birthJourney: BirthJourney) => Promise<void>>()
    .mockResolvedValue(undefined);

  await using view = renderEditor({
    birthJourney: "labor",
    onBirthJourneyChange,
  });

  fireEvent.click(view.getByRole("switch", { name: "Labour started" }));

  await vi.waitFor(() => {
    expect(onBirthJourneyChange).toHaveBeenCalledWith("planned_c_section");
  });
});

test("hides marked milestones from visitors without deleting them", async () => {
  const onBirthJourneyChange = vi
    .fn<(birthJourney: BirthJourney) => Promise<void>>()
    .mockResolvedValue(undefined);

  await using view = renderEditor({
    birthJourney: "labor",
    onBirthJourneyChange,
  });

  fireEvent.click(view.getByRole("switch", { name: "Labour started" }));

  await vi.waitFor(() => {
    expect(onBirthJourneyChange).toHaveBeenCalledWith("planned_c_section");
  });
  expect(view.queryByRole("heading", { name: "Remove marked milestones?" })).toBeNull();
});

test("reports a failed journey save from the editor", async () => {
  mocks.toastError.mockReset();
  const onBirthJourneyChange = vi
    .fn<(birthJourney: BirthJourney) => Promise<void>>()
    .mockRejectedValue(new Error("Network error"));

  await using view = renderEditor({
    birthJourney: "labor",
    onBirthJourneyChange,
  });

  fireEvent.click(view.getByRole("button", { name: "Home birth" }));

  await vi.waitFor(() => {
    expect(mocks.toastError).toHaveBeenCalledWith("Network error");
  });
});
