import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import { DashboardSettingsRoute, DashboardSettingsSheetView, Route } from "./settings";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";

function renderSettings(opts: {
  isAdmin: boolean;
  languageSettings: ReactNode;
  onSignOut: () => void;
}) {
  return renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <DashboardSettingsSheetView
        isAdmin={opts.isAdmin}
        languageSettings={opts.languageSettings}
        onSignOut={opts.onSignOut}
        overlay={{
          open: true,
          onOpenChange: () => undefined,
          onOpenChangeComplete: () => undefined,
        }}
      />
    </LocaleProvider>,
    { path: "/dashboard/settings" },
  );
}

test("profile sheet groups preferences and secondary dashboard actions", async () => {
  const onSignOut = vi.fn<() => void>();
  await using view = await renderSettings({
    isAdmin: true,
    languageSettings: <div>Language and timezone controls</div>,
    onSignOut,
  });

  expect(view.getByRole("dialog")).toBeTruthy();
  expect(view.getByRole("heading", { name: "Settings" })).toBeTruthy();
  expect(view.getByText("Language and timezone controls")).toBeTruthy();
  expect(view.getByRole("button", { name: "Toggle theme" })).toBeTruthy();
  expect(view.getByRole("link", { name: "Admin dashboard" }).getAttribute("href")).toContain(
    "/dashboard/admin",
  );
  expect(view.getByRole("button", { name: "Log out" })).toBeTruthy();
  expect(view.queryByText("Restart tour")).toBeNull();
});

test("settings route renders only its route-backed sheet overlay", () => {
  expect(Route.options).not.toHaveProperty("loader");
  expect(Route.options.component).toBe(DashboardSettingsRoute);
});

test("settings sheet omits the admin link for non-admins", async () => {
  await using view = await renderSettings({
    isAdmin: false,
    languageSettings: <div>Language and timezone controls</div>,
    onSignOut: () => undefined,
  });

  expect(view.getByRole("dialog")).toBeTruthy();
  expect(view.queryByRole("link", { name: "Admin dashboard" })).toBeNull();
  expect(view.queryByRole("button", { name: "Add Baby" })).toBeNull();
  expect(view.queryByRole("heading", { name: /Your babies/ })).toBeNull();
});
