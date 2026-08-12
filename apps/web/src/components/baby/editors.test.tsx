import { fireEvent, render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { NameEditor, StatusDateEditor } from "@/components/baby/editors";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import type { BabyData } from "@workspace/convex/src/types";

const baby: BabyData = {
  name: "Nova",
  dueDate: "2026-09-01",
  laborStarted: null,
  wentToHospital: null,
  babyBorn: null,
};

function renderResource(ui: React.ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("name editor mounts fresh on open: current name, reassurance note, trimmed save", async () => {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  await using view = renderResource(<NameEditor baby={baby} onUpdate={onUpdate} />);

  fireEvent.click(view.getByRole("button", { name: "Edit" }));

  // The form mounted with the current name and the link reassurance
  const input = view.getByLabelText("Baby name") as HTMLInputElement;
  expect(input.value).toBe("Nova");
  expect(view.getByText(/any link you've already shared keeps working/i)).toBeTruthy();

  // Save is dirty-gated
  const saveButton = view.getByRole("button", { name: "Save" }) as HTMLButtonElement;
  expect(saveButton.disabled).toBe(true);

  fireEvent.change(input, { target: { value: "  Nova Rae  " } });
  expect(saveButton.disabled).toBe(false);
  fireEvent.click(saveButton);

  await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ name: "Nova Rae" }));
  // The popover closed after a successful save
  await vi.waitFor(() => expect(view.queryByLabelText("Baby name")).toBeNull());
});

test("reopening the editor picks up the latest name without any reset", async () => {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  await using view = renderResource(<NameEditor baby={baby} onUpdate={onUpdate} />);

  // Open, type a draft, then cancel — the draft must not survive
  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  fireEvent.change(view.getByLabelText("Baby name"), { target: { value: "Scrapped draft" } });
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  await vi.waitFor(() => expect(view.queryByLabelText("Baby name")).toBeNull());

  // The name changes from outside (e.g. the mutation round-trip)
  view.rerender(<NameEditor baby={{ ...baby, name: "Nova Rae" }} onUpdate={onUpdate} />);

  // Reopening mounts a fresh form seeded with the latest name
  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  const input = view.getByLabelText("Baby name") as HTMLInputElement;
  expect(input.value).toBe("Nova Rae");
});

test("status editor confirms destructive deletion", async () => {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const bornBaby = {
    ...baby,
    laborStarted: "2026-08-10T08:00:00.000Z",
    wentToHospital: "2026-08-10T12:00:00.000Z",
    babyBorn: "2026-08-11T03:00:00.000Z",
  };
  await using view = renderResource(
    <StatusDateEditor
      baby={bornBaby}
      status="born"
      currentDate={bornBaby.babyBorn}
      onUpdate={onUpdate}
    />,
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  fireEvent.click(view.getByRole("button", { name: "Delete" }));

  expect(view.getByRole("alertdialog")).toBeTruthy();
  expect(view.getByText(/deletes its timeline update/i)).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Delete status" }));

  await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ babyBorn: null }));
});

test("status deletion is disabled until later statuses are deleted", async () => {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const bornBaby = {
    ...baby,
    wentToHospital: "2026-08-10T12:00:00.000Z",
    babyBorn: "2026-08-11T03:00:00.000Z",
  };
  await using view = renderResource(
    <TooltipProvider>
      <StatusDateEditor
        baby={bornBaby}
        status="gone_to_hospital"
        currentDate={bornBaby.wentToHospital}
        onUpdate={onUpdate}
      />
    </TooltipProvider>,
  );

  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  const deleteButton = view.getByRole("button", { name: "Delete" }) as HTMLButtonElement;
  expect(deleteButton.disabled).toBe(true);

  const tooltipTrigger = deleteButton.closest('[data-slot="tooltip-trigger"]');
  if (!tooltipTrigger) throw new Error("Tooltip trigger missing");
  expect(tooltipTrigger.getAttribute("aria-label")).toBe("Delete the Born status first");
  expect(view.queryByRole("alertdialog")).toBeNull();
  expect(onUpdate).not.toHaveBeenCalled();
});
