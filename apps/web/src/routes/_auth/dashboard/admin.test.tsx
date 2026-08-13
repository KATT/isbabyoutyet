import { fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { LocaleProvider } from "@/lib/i18n";
import type { TranslationFunction } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn<(opts: unknown) => void>(),
  loadMore: vi.fn<(numItems: number) => void>(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: (props: React.ComponentProps<"a"> & { to: string | undefined }) => (
    <a href={typeof props.to === "string" ? props.to : "#"} {...props} />
  ),
  createFileRoute: () => (opts: Record<string, unknown>) => ({
    ...opts,
    useSearch: () => ({ tab: "babies", sort: "updated" }),
  }),
  redirect: vi.fn<() => never>(),
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/lib/auth-server", () => ({
  authServer: { fetchAuthQuery: vi.fn<() => Promise<unknown>>() },
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: mocks.loadMore,
  }),
}));

const { AdminDashboardPage, BabiesSection, LanguageRequestsSection, formatWhen, statusLabel } =
  await import("@/routes/_auth/dashboard/admin");

function renderResource(ui: ReactElement) {
  const view = render(<LocaleProvider locale="en-GB">{ui}</LocaleProvider>);
  return makeResource(view, () => {
    view.unmount();
  });
}

const t = ((key: string) => key) as TranslationFunction;

const sampleBaby = {
  _id: "baby-1",
  name: "Avery",
  publicId: "baby-waiting",
  status: "not_yet" as const,
  demo: true,
  createdAt: 1,
  updatedAt: 2,
  managerEmails: ["owner@example.com", "co@example.com"],
};

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
  await using loading = renderResource(
    <LanguageRequestsSection
      requests={[]}
      status="LoadingFirstPage"
      onLoadMore={() => undefined}
    />,
  );
  expect(loading.getByRole("status", { name: "Loading" })).toBeTruthy();

  await using empty = renderResource(
    <LanguageRequestsSection requests={[]} status="Exhausted" onLoadMore={() => undefined} />,
  );
  expect(empty.getByText("No language requests yet")).toBeTruthy();

  await using filled = renderResource(
    <LanguageRequestsSection
      status="Exhausted"
      onLoadMore={() => undefined}
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

test("babies section sorts via table headers", async () => {
  const onSortByChange = vi.fn<(sortBy: "created" | "updated") => void>();
  await using view = renderResource(
    <BabiesSection
      sortBy="updated"
      status="Exhausted"
      onSortByChange={onSortByChange}
      onLoadMore={() => undefined}
      babies={[
        sampleBaby,
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
  expect(view.getByText("Baby born")).toBeTruthy();

  fireEvent.click(view.getByRole("button", { name: "Created" }));
  expect(onSortByChange).toHaveBeenCalledWith("created");
  fireEvent.click(view.getByRole("button", { name: "Updated" }));
  expect(onSortByChange).toHaveBeenCalledWith("updated");
});

test("babies section keeps previous rows while a sort refresh is loading", async () => {
  const first = render(
    <LocaleProvider locale="en-GB">
      <BabiesSection
        sortBy="updated"
        status="Exhausted"
        onSortByChange={() => undefined}
        onLoadMore={() => undefined}
        babies={[sampleBaby]}
      />
    </LocaleProvider>,
  );
  expect(first.getByText("Avery")).toBeTruthy();

  first.rerender(
    <LocaleProvider locale="en-GB">
      <BabiesSection
        sortBy="created"
        status="LoadingFirstPage"
        onSortByChange={() => undefined}
        onLoadMore={() => undefined}
        babies={[]}
      />
    </LocaleProvider>,
  );

  expect(first.getByText("Avery")).toBeTruthy();
  expect(first.getByText("Loading")).toBeTruthy();
  first.unmount();
});

test("babies section shows a spinner on first load and while loading more", async () => {
  await using firstLoad = renderResource(
    <BabiesSection
      babies={[]}
      status="LoadingFirstPage"
      sortBy="created"
      onSortByChange={() => undefined}
      onLoadMore={() => undefined}
    />,
  );
  expect(firstLoad.getByRole("status", { name: "Loading" })).toBeTruthy();

  await using loadingMore = renderResource(
    <BabiesSection
      sortBy="created"
      status="LoadingMore"
      onSortByChange={() => undefined}
      onLoadMore={() => undefined}
      babies={[{ ...sampleBaby, demo: false, managerEmails: [] }]}
    />,
  );
  expect(loadingMore.getByText("Avery")).toBeTruthy();
  expect(loadingMore.getAllByRole("status", { name: "Loading" }).length).toBeGreaterThan(0);
});

test("language requests section shows loading-more spinner", async () => {
  await using view = renderResource(
    <LanguageRequestsSection
      status="LoadingMore"
      onLoadMore={() => undefined}
      requests={[
        {
          _id: "req-1",
          requestedLocale: "French",
          createdAt: Date.UTC(2026, 0, 15, 12, 0),
          userId: "user-1",
          userEmail: "a@example.com",
        },
      ]}
    />,
  );
  expect(view.getByText("French")).toBeTruthy();
  expect(view.getAllByRole("status", { name: "Loading" }).length).toBeGreaterThan(0);
});

test("infinite scroll sentinel requests another page when visible", async () => {
  const onLoadMore = vi.fn<() => void>();
  type ObserverCallback = IntersectionObserverCallback;
  const observers: ObserverCallback[] = [];

  const OriginalObserver = globalThis.IntersectionObserver;
  class MockIntersectionObserver {
    callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
      observers.push(callback);
    }
    observe() {
      this.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;

  await using _view = renderResource(
    <BabiesSection
      sortBy="updated"
      status="CanLoadMore"
      onSortByChange={() => undefined}
      onLoadMore={onLoadMore}
      babies={[sampleBaby]}
    />,
  );

  expect(onLoadMore).toHaveBeenCalled();
  expect(observers.length).toBeGreaterThan(0);
  globalThis.IntersectionObserver = OriginalObserver;
});

test("admin dashboard page wires tabs and sort into the URL search", async () => {
  await using view = renderResource(<AdminDashboardPage />);
  expect(view.getByText("Admin dashboard")).toBeTruthy();
  expect(view.getByRole("tab", { name: "All babies" })).toBeTruthy();
  expect(view.getByRole("tab", { name: "Requested languages" })).toBeTruthy();

  fireEvent.click(view.getByRole("tab", { name: "Requested languages" }));
  expect(mocks.navigate).toHaveBeenCalled();
});
