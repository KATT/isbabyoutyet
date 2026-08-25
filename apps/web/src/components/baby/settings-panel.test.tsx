import { fireEvent, render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { SettingsPanel } from "@/components/baby/settings-panel";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { BabyData, BabyUpdateHandler, MilestoneRemoveHandler } from "@workspace/convex/src/types";
import { LocaleProvider } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn<(message: string) => void>(),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}));

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

function renderResource(ui: React.ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("settings dialog shows page fields when open and stays closed when not", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using closed = renderResource(
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

  await using open = renderResource(
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
  expect(open.getByText("Labour started")).toBeTruthy();
  expect(open.getByText("Theme")).toBeTruthy();
  expect(open.getByRole("heading", { level: 3, name: "Page details" })).toBeTruthy();
  expect(open.getByRole("heading", { level: 3, name: "Birth journey" })).toBeTruthy();
  expect(open.getByRole("heading", { level: 3, name: "Appearance" })).toBeTruthy();
  expect(open.queryByText("Delete page")).toBeNull();

  fireEvent.click(open.getByRole("button", { name: "Close" }));
  expect(onOpenChange).toHaveBeenCalled();
  expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
});

test("due date row previews optional public text", async () => {
  await using view = renderResource(
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

  await using view = renderResource(
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
  expect(onDelete).toHaveBeenCalled();
});
test("falls back to the default label for an unknown legacy theme", async () => {
  await using view = renderResource(
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

  await using view = renderResource(
    <SettingsPanel
      baby={baby}
      onUpdate={onUpdate}
      open
      onOpenChange={onOpenChange}
      {...absentSettingsProps}
    />,
  );

  fireEvent.click(view.getByRole("combobox", { name: "Language" }));
  const swedish = view.getByRole("option", { name: "Swedish" });
  fireEvent.pointerDown(swedish, { pointerType: "mouse" });
  fireEvent.click(swedish);
  expect(onUpdate).toHaveBeenCalledWith({ locale: "sv" });

  fireEvent.click(view.getByRole("combobox", { name: "Language" }));
  const inherited = view.getByRole("option", {
    name: "Use my profile language (British English)",
  });
  fireEvent.pointerDown(inherited, { pointerType: "mouse" });
  fireEvent.click(inherited);
  expect(onUpdate).toHaveBeenCalledWith({ locale: null });
});

test("journey selection saves the chosen preset", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using view = renderResource(
    <SettingsPanel
      baby={baby}
      onUpdate={onUpdate}
      open
      onOpenChange={onOpenChange}
      {...absentSettingsProps}
    />,
  );

  expect(view.getByText("Journey")).toBeTruthy();
  expect(view.getByRole("button", { name: "Labour" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Home birth" }));
  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ birthJourney: "home_birth" });
  });
});

test("journey editor reports a failed save", async () => {
  mocks.toastError.mockReset();
  const onUpdate = vi
    .fn<BabyUpdateHandler>()
    .mockRejectedValue(new Error("Could not save journey"));
  await using view = renderResource(
    <SettingsPanel
      baby={baby}
      onUpdate={onUpdate}
      open
      onOpenChange={vi.fn<(open: boolean) => void>()}
      {...absentSettingsProps}
    />,
  );

  fireEvent.click(view.getByRole("button", { name: "Home birth" }));

  await vi.waitFor(() => {
    expect(mocks.toastError).toHaveBeenCalledWith("Could not save journey");
  });
});

test("turning off a marked milestone warns before removing it", async () => {
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);
  const onMilestoneRemove = vi.fn<MilestoneRemoveHandler>().mockResolvedValue(undefined);

  await using view = renderResource(
    <SettingsPanel
      baby={baby}
      onUpdate={onUpdate}
      open
      onOpenChange={vi.fn<(open: boolean) => void>()}
      onMilestoneRemove={onMilestoneRemove}
      {...absentSettingsProps}
    />,
  );

  fireEvent.click(view.getByRole("switch", { name: "Labour started" }));
  expect(view.getByRole("heading", { name: "Remove marked milestones?" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Remove and continue" }));

  await vi.waitFor(() => {
    expect(onMilestoneRemove).toHaveBeenCalledWith("labor_started");
  });
  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ birthJourney: "planned_c_section" });
  });
});

test("journey selection stays changeable after milestone updates", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using view = renderResource(
    <SettingsPanel
      baby={{ ...baby, wentToHospital: "2026-08-10T12:00:00.000Z" }}
      onUpdate={onUpdate}
      open
      onOpenChange={onOpenChange}
      {...absentSettingsProps}
      birthJourney="home_birth"
    />,
  );

  expect(view.getByText("Gone to hospital")).toBeTruthy();
  expect(view.getByRole("button", { name: "Home birth" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Planned C-section" }));
  await vi.waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith({ birthJourney: "planned_c_section" });
  });
});

test("theme constants render through the active translation catalog", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using view = renderResource(
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
  expect(view.getByText("Mango")).toBeTruthy();
  expect(view.getByText("Resa")).toBeTruthy();
  expect(view.getByText("Förlossning")).toBeTruthy();
});
