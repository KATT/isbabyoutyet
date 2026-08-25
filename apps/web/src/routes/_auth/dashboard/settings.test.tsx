import { api } from "@workspace/convex/convex/_generated/api";
import { testPreloadedConvexQuery } from "@workspace/convex-prefetch/test-helpers";
import { makeAsyncResource, makeResource } from "@workspace/convex/convex/test.resource";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import {
  DashboardSettingsRoute,
  DashboardSettingsSheet,
  DashboardSettingsSheetView,
  Route,
} from "./settings";
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
  const client = new ConvexReactClient("https://example.invalid", {
    unsavedChangesWarning: false,
  });
  await using _client = makeAsyncResource(client, async () => {
    await client.close();
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await using _queryClient = makeResource(queryClient, () => {
    queryClient.clear();
  });

  const profile = testPreloadedConvexQuery<typeof api.profile.get>({
    input: {},
    initialData: { locale: "en-GB", timeZone: "Europe/London", isAdmin: false },
  });

  await using view = await renderWithTestRouter(
    <QueryClientProvider client={queryClient}>
      <ConvexProvider client={client}>
        <LocaleProvider locale="en-GB">
          <DashboardSettingsSheet profile={profile} />
        </LocaleProvider>
      </ConvexProvider>
    </QueryClientProvider>,
    { path: "/dashboard/settings" },
  );

  // Overlay opens after rAF so Base UI can play the enter transition.
  await vi.waitFor(() => {
    expect(view.getByRole("dialog")).toBeTruthy();
  });
  expect(view.getByRole("heading", { name: "Settings" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Log out" })).toBeTruthy();
});
