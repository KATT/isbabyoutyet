import { fireEvent } from "@testing-library/react";
import { convexQuery } from "@convex-dev/react-query";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { api } from "@workspace/convex/convex/_generated/api";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import {
  DashboardSettingsRoute,
  DashboardSettingsSheet,
  DashboardSettingsSheetView,
  Route,
  settingsAuthAdapter,
} from "./settings";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import { signUpTestUser } from "@/test/convexTestSeed";
import { renderWithConvexTest } from "@/test/renderWithConvexTest";
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

test("DashboardSettingsSheet wires the preloaded profile into the view", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "ada@example.com",
    password: "password123",
    name: "Ada",
  });
  harness.withIdentity({ subject: userId });

  const profile = await harness.convexPreloader.ensureQueryData(api.profile.get, {});

  await using view = await renderWithConvexTest({
    harness,
    ui: <DashboardSettingsSheet profile={profile} queryClient={harness.queryClient} />,
    wrap: null,
  });

  // Overlay opens after rAF so Base UI can play the enter transition.
  await vi.waitFor(() => {
    expect(view.getByRole("dialog")).toBeTruthy();
  });
  expect(view.getByRole("heading", { name: "Settings" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Log out" })).toBeTruthy();
});

test("settings sheet log-out button invokes the injected handler", async () => {
  const onSignOut = vi.fn<() => void>();
  await using view = await renderSettings({
    isAdmin: false,
    languageSettings: <div>Language and timezone controls</div>,
    onSignOut,
  });

  fireEvent.click(view.getByRole("button", { name: "Log out" }));
  await vi.waitFor(() => {
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

test("DashboardSettingsSheet signs out through the auth adapter", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "admin@example.com",
    password: "password123",
    name: "Admin",
  });
  harness.withIdentity({ subject: userId });

  // @ts-expect-error — stub return is not the full signOut result
  const signOut = vi.fn<typeof settingsAuthAdapter.signOut>(async (opts) => {
    // @ts-expect-error — empty object is not the Better Auth onSuccess context
    opts?.fetchOptions?.onSuccess?.({});
    return { data: null, error: null };
  });
  const originalSignOut = settingsAuthAdapter.signOut;
  settingsAuthAdapter.signOut = signOut;
  await using _adapter = makeResource({}, () => {
    settingsAuthAdapter.signOut = originalSignOut;
  });

  const profile = await harness.convexPreloader.ensureQueryData(api.profile.get, {});
  harness.queryClient.setQueryData(convexQuery(api.baby.listByUser, {}).queryKey, [
    { _id: "baby-id", name: "Baby Smith" },
  ]);

  await using view = await renderWithConvexTest({
    harness,
    ui: <DashboardSettingsSheet profile={profile} queryClient={harness.queryClient} />,
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(view.getByRole("dialog")).toBeTruthy();
  });
  fireEvent.click(view.getByRole("button", { name: "Log out" }));
  await vi.waitFor(() => {
    expect(
      harness.queryClient.getQueryData(convexQuery(api.baby.listByUser, {}).queryKey),
    ).toBeUndefined();
    expect(signOut).toHaveBeenCalled();
  });
});
