import { fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { LocaleProvider } from "@/lib/i18n";
import type { TranslationFunction } from "@/lib/i18n";

vi.mock("@tanstack/react-router", () => ({
  Link: (props: React.ComponentProps<"a"> & { to: string | undefined }) => (
    <a href={typeof props.to === "string" ? props.to : "#"} {...props} />
  ),
  createFileRoute: () => (opts: { component: unknown }) => opts,
  redirect: vi.fn<() => never>(),
}));

vi.mock("@/lib/auth-server", () => ({
  authServer: { fetchAuthQuery: vi.fn<() => Promise<unknown>>() },
}));

const { BabiesSection, LanguageRequestsSection, formatWhen, statusLabel } =
  await import("@/routes/_auth/dashboard/admin");

function renderResource(ui: ReactElement) {
  const view = render(<LocaleProvider locale="en-GB">{ui}</LocaleProvider>);
  return makeResource(view, () => {
    view.unmount();
  });
}

const t = ((key: string) => key) as TranslationFunction;

test("statusLabel covers every baby status", () => {
  expect(statusLabel("not_yet", t)).toBe("Not yet");
  expect(statusLabel("labor_started", t)).toBe("Labour started");
  expect(statusLabel("gone_to_hospital", t)).toBe("Gone to hospital");
  expect(statusLabel("born", t)).toBe("Baby born");
});

test("formatWhen returns a locale-aware timestamp", () => {
  expect(formatWhen(Date.UTC(2026, 0, 15, 12, 30), "en-GB")).toMatch(/15/);
});

test("language requests section shows empty, loading, and rows", async () => {
  await using loading = renderResource(<LanguageRequestsSection requests={undefined} />);
  expect(loading.getByRole("status", { name: "Loading" })).toBeTruthy();

  await using empty = renderResource(<LanguageRequestsSection requests={[]} />);
  expect(empty.getByText("No language requests yet")).toBeTruthy();

  await using filled = renderResource(
    <LanguageRequestsSection
      requests={[
        {
          _id: "req-1",
          requestedLocale: "French",
          createdAt: Date.UTC(2026, 0, 15, 12, 0),
          userId: "user-1",
          userEmail: "a@example.com",
        },
        {
          _id: "req-2",
          requestedLocale: "German",
          createdAt: Date.UTC(2026, 0, 16, 12, 0),
          userId: "user-2",
          userEmail: null,
        },
      ]}
    />,
  );
  expect(filled.getByText("French")).toBeTruthy();
  expect(filled.getByText("a@example.com")).toBeTruthy();
  expect(filled.getByText("user-2")).toBeTruthy();
});

test("babies section sorts and shows demo managers", async () => {
  const onSortByChange = vi.fn<(sortBy: "created" | "updated") => void>();
  await using view = renderResource(
    <BabiesSection
      sortBy="updated"
      onSortByChange={onSortByChange}
      babies={[
        {
          _id: "baby-1",
          name: "Avery",
          publicId: "baby-waiting",
          status: "not_yet",
          demo: true,
          createdAt: 1,
          updatedAt: 2,
          managerEmails: ["owner@example.com", "co@example.com"],
        },
        {
          _id: "baby-2",
          name: "Milo",
          publicId: "baby-born",
          status: "born",
          demo: false,
          createdAt: 3,
          updatedAt: 4,
          managerEmails: ["owner@example.com"],
        },
      ]}
    />,
  );

  expect(view.getByText("Avery")).toBeTruthy();
  expect(view.getByText("Demo")).toBeTruthy();
  expect(view.getByText("owner@example.com, co@example.com")).toBeTruthy();
  expect(view.getByText("Not yet")).toBeTruthy();
  expect(view.getByText("Baby born")).toBeTruthy();

  fireEvent.change(view.getByLabelText("Sort by updated"), { target: { value: "created" } });
  expect(onSortByChange).toHaveBeenCalledWith("created");
});

test("babies section shows a spinner while loading", async () => {
  await using view = renderResource(
    <BabiesSection babies={undefined} sortBy="created" onSortByChange={() => undefined} />,
  );
  expect(view.getByRole("status", { name: "Loading" })).toBeTruthy();
});
