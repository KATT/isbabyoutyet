import { fireEvent, render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { SettingsPanel } from "@/components/baby/settings-panel";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { BabyData, BabyUpdateHandler } from "@workspace/convex/src/types";
import { LocaleProvider } from "@/lib/i18n";

const baby: BabyData = {
  name: "Nova",
  dueDate: "2026-09-01T00:00:00.000Z",
  theme: null,
  laborStarted: "2026-08-10T08:00:00.000Z",
  wentToHospital: null,
  babyBorn: null,
  hospitalMessage: null,
  babyBornMessage: null,
  laborStartedMessage: null,
  encouragementsDisabled: false,
  photoId: null,
};

const absentSettingsProps = {
  profileLocale: "en-GB" as const,
  onDelete: null,
  coParents: null,
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
  expect(open.getByText("Labour started")).toBeTruthy();
  expect(open.getByText("Theme")).toBeTruthy();
  expect(open.getByText("Messages")).toBeTruthy();
  expect(open.getByText("Visitors can send messages")).toBeTruthy();
  expect(open.queryByText("Delete page")).toBeNull();

  fireEvent.click(open.getByRole("button", { name: "Close" }));
  expect(onOpenChange).toHaveBeenCalled();
  expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
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
      open={true}
      onOpenChange={onOpenChange}
      profileLocale="en-GB"
      coParents={null}
    />,
  );

  expect(view.getByText("Delete page")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Delete" }));
  expect(view.getByRole("heading", { name: "Delete Nova's page?" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Delete page" }));
  expect(onDelete).toHaveBeenCalled();
});
test("encouragements switch toggles the disabled flag via onUpdate", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using view = renderResource(
    <SettingsPanel
      baby={baby}
      onUpdate={onUpdate}
      open={true}
      onOpenChange={onOpenChange}
      {...absentSettingsProps}
    />,
  );

  fireEvent.click(view.getByRole("switch"));
  expect(onUpdate).toHaveBeenCalledWith({ encouragementsDisabled: true });
});

test("planned C-section settings show the relevant journey and date labels", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using view = renderResource(
    <SettingsPanel
      baby={{
        ...baby,
        birthJourney: "planned_c_section",
        laborStarted: null,
        wentToHospital: "2026-08-10T09:00:00.000Z",
      }}
      onUpdate={onUpdate}
      open
      onOpenChange={onOpenChange}
      {...absentSettingsProps}
    />,
  );

  expect(view.getByText("C-section date")).toBeTruthy();
  expect(view.getByText("Planned C-section — hospital and birth milestones")).toBeTruthy();
  expect(
    view.getByText(
      "Only page managers can see this choice. Visitors see neutral planned-date updates.",
    ),
  ).toBeTruthy();
  expect(view.getByText("At hospital")).toBeTruthy();
  expect(view.queryByText("Gone to hospital")).toBeNull();
  expect((view.getByRole("combobox", { name: "Birth plan" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(
    view.getByText("The birth plan cannot be changed after the hospital milestone."),
  ).toBeTruthy();
});

test("home-birth settings describe the two-step private journey", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using view = renderResource(
    <SettingsPanel
      baby={{
        ...baby,
        birthJourney: "home_birth",
        laborStarted: null,
      }}
      onUpdate={onUpdate}
      open
      onOpenChange={onOpenChange}
      {...absentSettingsProps}
    />,
  );

  expect(view.getByText("Home birth — labour and birth milestones")).toBeTruthy();
  expect((view.getByRole("combobox", { name: "Birth plan" }) as HTMLButtonElement).disabled).toBe(
    false,
  );
});

test("theme constants render through the active translation catalog", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onUpdate = vi.fn<BabyUpdateHandler>().mockResolvedValue(undefined);

  await using view = renderResource(
    <LocaleProvider locale="sv">
      <SettingsPanel
        baby={baby}
        onUpdate={onUpdate}
        open
        onOpenChange={onOpenChange}
        profileLocale="sv"
        onDelete={null}
        coParents={null}
      />
    </LocaleProvider>,
  );

  expect(view.getByText("Tema")).toBeTruthy();
  expect(view.getByText("Standard")).toBeTruthy();
});
