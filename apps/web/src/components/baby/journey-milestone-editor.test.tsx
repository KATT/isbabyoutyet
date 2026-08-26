import { fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { BirthJourney } from "@workspace/convex/src/types";
import { LocaleProvider } from "@/lib/i18n";
import { JourneyMilestoneEditor } from "./journey-milestone-editor";

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
    <LocaleProvider locale="en-GB">
      <JourneyMilestoneEditor
        birthJourney={opts.birthJourney}
        idPrefix="test-journey"
        onBirthJourneyChange={opts.onBirthJourneyChange}
      />
    </LocaleProvider>,
  );
}

function spyOnToastErrorResource() {
  const toastError = vi.spyOn(toast, "error").mockReturnValue("toast-id");
  return makeResource(toastError, () => {
    toastError.mockRestore();
  });
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

test("applies hospital visibility toggle", async () => {
  const onBirthJourneyChange = vi.fn<(birthJourney: BirthJourney) => Promise<void>>().mockResolvedValue(undefined);

  await using view = renderEditor({
    birthJourney: "labor",
    onBirthJourneyChange,
  });

  fireEvent.click(view.getByRole("switch", { name: "Gone to hospital" }));

  await vi.waitFor(() => {
    expect(onBirthJourneyChange).toHaveBeenCalledWith("home_birth");
  });
});

test("reports a failed journey save from the editor", async () => {
  await using toastError = spyOnToastErrorResource();
  const onBirthJourneyChange = vi
    .fn<(birthJourney: BirthJourney) => Promise<void>>()
    .mockRejectedValue(new Error("Network error"));

  await using view = renderEditor({
    birthJourney: "labor",
    onBirthJourneyChange,
  });

  fireEvent.click(view.getByRole("button", { name: "Home birth" }));

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith("Network error");
  });
});
