import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { LocaleProvider } from "@/lib/i18n";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: unknown }) => ({
    ...options,
    useLoaderData: () => ({ babies: {}, onboarding: {} }),
  }),
  getRouteApi: () => ({
    useRouteContext: () => ({
      profile: {
        input: {},
        initialData: { locale: "en-GB", timeZone: "Europe/London", isAdmin: true },
      },
    }),
  }),
  Link: (props: React.ComponentProps<"a"> & { to: string | undefined }) => (
    <a href={typeof props.to === "string" ? props.to : "#"}>{props.children}</a>
  ),
}));

vi.mock("@workspace/convex-prefetch", () => ({
  usePreloadedConvexQuery: () => ({ data: { isAdmin: true } }),
}));

vi.mock("@/components/language-settings", () => ({
  LanguageSettings: () => <div>Language and timezone controls</div>,
}));

vi.mock("@workspace/ui/components/mode-toggle", () => ({
  ModeToggle: () => <button type="button">Toggle theme</button>,
}));

vi.mock("@workspace/ui/components/sheet", () => ({
  Sheet: (props: { children: ReactNode }) => <div>{props.children}</div>,
  SheetContent: (props: { children: ReactNode }) => <aside>{props.children}</aside>,
  SheetDescription: (props: { children: ReactNode }) => <p>{props.children}</p>,
  SheetFooter: (props: { children: ReactNode }) => <footer>{props.children}</footer>,
  SheetHeader: (props: { children: ReactNode }) => <header>{props.children}</header>,
  SheetTitle: (props: { children: ReactNode }) => <h2>{props.children}</h2>,
}));

vi.mock("@/lib/overlay-nav", () => ({
  useDashboardSettingsOverlayNav: () => ({
    open: true,
    onOpenChange: vi.fn<(open: boolean) => void>(),
    onOpenChangeComplete: vi.fn<(open: boolean) => void>(),
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn<() => Promise<void>>(async () => {}) },
}));

vi.mock("@/routes/_auth/dashboard/admin", () => ({
  ADMIN_DEFAULT_SEARCH: {},
}));

vi.mock("@/routes/_auth/dashboard/index", () => ({
  DashboardPage: () => null,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn<(message: string) => void>() },
}));

const { DashboardSettingsSheet } = await import("./settings");

function renderResource(ui: ReactElement) {
  const view = render(<LocaleProvider locale="en-GB">{ui}</LocaleProvider>);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("profile sheet groups preferences and secondary dashboard actions", async () => {
  await using view = renderResource(<DashboardSettingsSheet />);

  expect(view.getByRole("heading", { name: "Settings" })).toBeTruthy();
  expect(view.getByText("Language and timezone controls")).toBeTruthy();
  expect(view.getByRole("button", { name: "Toggle theme" })).toBeTruthy();
  expect(view.getByRole("link", { name: "Admin dashboard" }).getAttribute("href")).toBe(
    "/dashboard/admin",
  );
  expect(view.getByRole("button", { name: "Log out" })).toBeTruthy();
  expect(view.queryByText("Restart tour")).toBeNull();
});
