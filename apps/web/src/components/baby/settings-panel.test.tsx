import { fireEvent, render } from "@testing-library/react";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import { SettingsPanel } from "@/components/baby/settings-panel";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type {
  BabyData,
  BabyUpdateHandler,
  MilestoneRemoveHandler,
} from "@workspace/convex/src/types";
import { LocaleProvider } from "@/lib/i18n";

function spyOnToastErrorResource() {
  const toastError = vi.spyOn(toast, "error").mockReturnValue("toast-id");
  return makeResource(toastError, () => {
    toastError.mockRestore();
  });
}

const baby: BabyData = {
  name: "Nova",
  timeZone: "Europe/London",
  dueDate: "2026-09-01T00:00:00.000Z",
  dueDateDisplayMode: "exact",
  publicDueDateText: null,
  theme: null,
  laborStarted: "2026-08-10T08:00:00.000Z",
  wentToHospital: null,
  babyBorn: null,
  photoId: null,
  milestoneVisibility: { showLabor: true, showHospital: true },
};

const absentSettingsProps = {
  birthJourney: "labor" as const,
  profileLocale: "en-GB" as const,
  onDelete: null,
  coParents: null,
  onMilestoneRedate: () => undefined,
  onMilestoneRemove: () => undefined,
  onOpenChangeComplete: null,
};

function openJourneyEditor(view: ReturnType<typeof render>) {
  fireEvent.click(view.getByRole("button", { name: "Edit journey" }));
}

/** Press the modal dialog's backdrop the way a real pointer would. */
function clickDialogBackdrop(view: ReturnType<typeof render>) {
  const backdrop = view.baseElement.querySelector("[data-slot=dialog-overlay]");
  if (!backdrop) throw new Error("dialog backdrop missing");
  fireEvent.pointerDown(backdrop, { pointerType: "mouse" });
  fireEvent.mouseDown(backdrop);
  fireEvent.mouseUp(backdrop);
  fireEvent.click(backdrop);
}

function selectJourneyPreset(view: ReturnType<typeof render>, label: string) {
  fireEvent.click(view.getByRole("combobox", { name: "Presets" }));
  const option = view.getByRole("option", { name: label });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
}

test("settings dialog shows page fields when open and stays closed when not", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using closed = await renderWithTestRouter(
    <SettingsPanel
      baby={baby}
      onUpdate={onUpdate}
      open={false}
      onOpenChange={onOpenChange}
      {...absentSettingsProps}
    />,
  );
  expect(closed.queryByRole("dialog")).toBeNull();
  expect(closed.queryByText("Settings")).toBeNull();

  await using open = await renderWithTestRouter(
    <SettingsPanel
      baby={baby}
      onUpdate={onUpdate}
      open={true}
      onOpenChange={onOpenChange}
      {...absentSettingsProps}
    />,
  );

  expect(open.getByRole("dialog")).toBeTruthy();
  expect(open.getByRole("heading", { name: "Settings" })).toBeTruthy();
  expect(open.getByText("Baby name")).toBeTruthy();
  expect(open.getByText("Nova")).toBeTruthy();
  expect(open.getByText("Due date")).toBeTruthy();
  expect(
    open.getByText("1 September 2026 · Visitors see the exact date and countdown."),
  ).toBeTruthy();
  expect(open.getAllByText("Labour started").length).toBeGreaterThan(0);
  expect(open.getByText("Theme")).toBeTruthy();
  expect(open.getByRole("heading", { level: 3, name: "Page details" })).toBeTruthy();
  expect(open.getByRole("heading", { level: 3, name: "Birth journey" })).toBeTruthy();
  expect(open.getByRole("heading", { level: 3, name: "Appearance" })).toBeTruthy();
  expect(
    open.getByText("Visitors see: Labour started → Gone to hospital → Baby born"),
  ).toBeTruthy();
  expect(open.queryByRole("button", { name: "Labour" })).toBeNull();

  expect(open.queryByText("Delete page")).toBeNull();

  fireEvent.click(open.getByRole("button", { name: "Close" }));
  expect(onOpenChange).toHaveBeenCalled();
  expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
});

test("closing settings with a dirty nested editor prompts before discarding", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <SettingsPanel
        baby={baby}
        onUpdate={onUpdate}
        open
        onOpenChange={onOpenChange}
        {...absentSettingsProps}
      />
    </LocaleProvider>,
  );

  fireEvent.click(view.getAllByRole("button", { name: "Edit" })[0] as HTMLButtonElement);
  fireEvent.change(view.getByLabelText("Baby name"), { target: { value: "Draft name" } });
  fireEvent.click(view.getByRole("button", { name: "Close" }));

  expect(view.getByRole("alertdialog")).toBeTruthy();
  expect(view.getByText("Discard unsaved changes?")).toBeTruthy();
  expect(onOpenChange).not.toHaveBeenCalled();

  fireEvent.click(view.getByRole("button", { name: "Keep editing" }));
  await vi.waitFor(() => {
    expect(view.queryByRole("alertdialog")).toBeNull();
  });
  expect((view.getByLabelText("Baby name") as HTMLInputElement).value).toBe("Draft name");

  fireEvent.click(view.getByRole("button", { name: "Close" }));
  fireEvent.click(view.getByRole("button", { name: "Discard" }));
  expect(onOpenChange.mock.calls.some((call) => call[0] === false)).toBe(true);
});

test("clicking the backdrop with a dirty nested editor shows one prompt for the whole stack", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <SettingsPanel
        baby={baby}
        onUpdate={onUpdate}
        open
        onOpenChange={onOpenChange}
        {...absentSettingsProps}
      />
    </LocaleProvider>,
  );

  fireEvent.click(view.getAllByRole("button", { name: "Edit" })[0] as HTMLButtonElement);
  fireEvent.change(view.getByLabelText("Baby name"), { target: { value: "Draft name" } });

  // The dialog backdrop press dismisses both the dialog (modal outside press)
  // and the nested popover (outside its popup); the stack must answer with a
  // single prompt rather than two stacked alert dialogs.
  clickDialogBackdrop(view);

  expect(view.getAllByText("Discard unsaved changes?").length).toBe(1);
  expect(onOpenChange).not.toHaveBeenCalled();

  fireEvent.click(view.getByRole("button", { name: "Keep editing" }));
  await vi.waitFor(() => {
    expect(view.queryByRole("alertdialog")).toBeNull();
  });
  expect((view.getByLabelText("Baby name") as HTMLInputElement).value).toBe("Draft name");

  clickDialogBackdrop(view);
  fireEvent.click(view.getByRole("button", { name: "Discard" }));

  await vi.waitFor(() => {
    expect(onOpenChange.mock.calls.some((call) => call[0] === false)).toBe(true);
  });
  await vi.waitFor(() => {
    expect(view.queryByLabelText("Baby name")).toBeNull();
  });
});

test("due date row previews optional public text", async () => {
  await using view = await renderWithTestRouter(
    <SettingsPanel
      baby={{
        ...baby,
        dueDate: null,
        dueDateDisplayMode: "message",
        publicDueDateText: "Any day now",
      }}
      onUpdate={vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined)}
      open
      onOpenChange={vi.fn<(open: boolean) => void>()}
      {...absentSettingsProps}
    />,
  );

  expect(view.getByText("Visitors see “Any day now”.")).toBeTruthy();
});

test("delete page control appears when onDelete is provided", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);
  const onDelete = vi.fn<() => void | Promise<void>>().mockResolvedValue(undefined);

  await using view = await renderWithTestRouter(
    <SettingsPanel
      baby={baby}
      onUpdate={onUpdate}
      onDelete={onDelete}
      birthJourney="labor"
      open={true}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={null}
      profileLocale="en-GB"
      coParents={null}
      onMilestoneRedate={() => undefined}
      onMilestoneRemove={() => undefined}
    />,
  );

  expect(view.getByText("Delete page")).toBeTruthy();
  expect(view.getByRole("heading", { level: 3, name: "Danger zone" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Delete" }));
  expect(view.getByRole("heading", { name: "Delete Nova's page?" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Delete page" }));
  await vi.waitFor(() => {
    expect(onDelete).toHaveBeenCalled();
  });
});
test("falls back to the default label for an unknown legacy theme", async () => {
  await using view = await renderWithTestRouter(
    <SettingsPanel
      baby={{ ...baby, theme: "legacy-theme" }}
      onUpdate={vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined)}
      open
      onOpenChange={vi.fn<(open: boolean) => void>()}
      {...absentSettingsProps}
    />,
  );

  expect(view.getByText("Mango")).toBeTruthy();
});

test("page language selection saves the locale override", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using view = await renderWithTestRouter(
    <SettingsPanel
      baby={baby}
      onUpdate={onUpdate}
      open
      onOpenChange={onOpenChange}
      {...absentSettingsProps}
    />,
  );

  const languageTrigger = view.getByRole("combobox", { name: "Language" });
  // Closed value matches the dropdown label, not the raw "inherit" sentinel
  expect(languageTrigger.textContent).toContain("Use my profile language (British English)");
  expect(languageTrigger.className).toMatch(/max-w-44/);

  fireEvent.click(languageTrigger);
  const swedish = view.getByRole("option", { name: "Swedish" });
  fireEvent.pointerDown(swedish, { pointerType: "mouse" });
  fireEvent.click(swedish);
  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ locale: "sv" });
  });

  fireEvent.click(view.getByRole("combobox", { name: "Language" }));
  const inherited = view.getByRole("option", {
    name: "Use my profile language (British English)",
  });
  fireEvent.pointerDown(inherited, { pointerType: "mouse" });
  fireEvent.click(inherited);
  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ locale: null });
  });
});

test("journey selection saves the chosen preset after Save", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using view = await renderWithTestRouter(
    <SettingsPanel
      baby={baby}
      onUpdate={onUpdate}
      open
      onOpenChange={onOpenChange}
      {...absentSettingsProps}
    />,
  );

  expect(view.getByText("Journey")).toBeTruthy();
  openJourneyEditor(view);
  expect(view.getByRole("combobox", { name: "Presets" }).textContent).toContain("Labour");
  const saveButton = view.getByRole("button", { name: "Save" }) as HTMLButtonElement;
  expect(saveButton.disabled).toBe(true);
  selectJourneyPreset(view, "Home birth");
  expect(onUpdate).not.toHaveBeenCalled();
  expect(saveButton.disabled).toBe(false);
  fireEvent.click(saveButton);
  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ birthJourney: "home_birth" });
  });
});

test("journey editor reports a failed save and remains open", async () => {
  await using toastError = spyOnToastErrorResource();
  const onUpdate = vi
    .fn<BabyUpdateHandler>()
    .mockRejectedValue(new Error("Could not save journey"));
  await using view = await renderWithTestRouter(
    <SettingsPanel
      baby={baby}
      onUpdate={onUpdate}
      open
      onOpenChange={vi.fn<(open: boolean) => void>()}
      {...absentSettingsProps}
    />,
  );

  openJourneyEditor(view);
  selectJourneyPreset(view, "Home birth");
  fireEvent.click(view.getByRole("button", { name: "Save" }));

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith("Could not save journey");
  });
  expect(view.getByRole("combobox", { name: "Presets" }).textContent).toContain("Home birth");
});

test("turning off visitor visibility does not remove a marked milestone", async () => {
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);
  const onMilestoneRemove = vi.fn<MilestoneRemoveHandler>().mockResolvedValue(undefined);

  await using view = await renderWithTestRouter(
    <SettingsPanel
      baby={baby}
      onUpdate={onUpdate}
      open
      onOpenChange={vi.fn<(open: boolean) => void>()}
      {...absentSettingsProps}
      onMilestoneRemove={onMilestoneRemove}
    />,
  );

  openJourneyEditor(view);

  fireEvent.click(view.getByRole("switch", { name: "Labour started" }));
  fireEvent.click(view.getByRole("button", { name: "Save" }));

  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ birthJourney: "planned_c_section" });
  });
  expect(onMilestoneRemove).not.toHaveBeenCalled();
  expect(view.queryByRole("heading", { name: "Remove marked milestones?" })).toBeNull();
});

test("journey selection stays changeable after milestone updates", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using view = await renderWithTestRouter(
    <SettingsPanel
      baby={{ ...baby, laborStarted: null, wentToHospital: "2026-08-10T12:00:00.000Z" }}
      onUpdate={onUpdate}
      open
      onOpenChange={onOpenChange}
      {...absentSettingsProps}
      birthJourney="home_birth"
    />,
  );

  expect(view.getAllByText("Gone to hospital").length).toBeGreaterThan(0);
  openJourneyEditor(view);
  expect(view.getByRole("combobox", { name: "Presets" }).textContent).toContain("Home birth");
  selectJourneyPreset(view, "Planned C-section");
  fireEvent.click(view.getByRole("button", { name: "Save" }));
  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ birthJourney: "planned_c_section" });
  });
});

test("theme constants render through the active translation catalog", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using view = await renderWithTestRouter(
    <LocaleProvider locale="sv">
      <SettingsPanel
        baby={baby}
        birthJourney="labor"
        onUpdate={onUpdate}
        open
        onOpenChange={onOpenChange}
        onOpenChangeComplete={null}
        profileLocale="sv"
        onDelete={null}
        coParents={null}
        onMilestoneRedate={() => undefined}
        onMilestoneRemove={() => undefined}
      />
    </LocaleProvider>,
  );

  expect(view.getByText("Tema")).toBeTruthy();
  expect(view.getAllByText("Mango").length).toBeGreaterThan(0);
  expect(view.getByText("Resa")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Redigera resa" }));
  expect(view.getByRole("combobox", { name: "Förval" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Spara" })).toBeTruthy();
});
