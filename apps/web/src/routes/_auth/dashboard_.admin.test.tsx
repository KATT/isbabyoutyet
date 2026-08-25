import { fireEvent } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { expect, test, vi } from "vitest";
import { api } from "@workspace/convex/convex/_generated/api";
import { LocaleProvider } from "@/lib/i18n";
import type { TranslationFunction } from "@/lib/i18n";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import {
  AdminDashboardPage,
  AdminDashboardView,
  BabiesSection,
  LanguageRequestsSection,
  Route as AdminRoute,
  formatWhen,
  nextSortSearch,
  statusLabel,
} from "@/routes/_auth/dashboard_.admin";

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

function renderAdmin(ui: ReactElement) {
  return renderWithTestRouter(<LocaleProvider locale="en-GB">{ui}</LocaleProvider>, {
    path: "/dashboard/admin",
  });
}

test("admin remains a standalone non-nested dashboard route", () => {
  // Underscored `dashboard_` keeps this sibling of `/dashboard`, not a child.
  expect(AdminRoute.options.component).toBe(AdminDashboardPage);
});

test("statusLabel covers every baby status", () => {
  expect(statusLabel("not_yet", t)).toBe("Not yet");
  expect(statusLabel("labor_started", t)).toBe("Labour started");
  expect(statusLabel("gone_to_hospital", t)).toBe("Gone to hospital");
  expect(statusLabel("born", t)).toBe("Baby born");
});

test("formatWhen returns a locale-aware timestamp", () => {
  expect(formatWhen(Date.UTC(2026, 0, 15, 12, 30), "en-GB")).toMatch(/15/);
});

test("nextSortSearch defaults to desc and only toggles to asc on the active desc column", () => {
  expect(
    nextSortSearch({ currentSort: "updated", currentOrder: "desc", clicked: "updated" }),
  ).toEqual({ sort: "updated", order: "asc" });
  expect(
    nextSortSearch({ currentSort: "updated", currentOrder: "asc", clicked: "updated" }),
  ).toEqual({ sort: "updated", order: "desc" });
  expect(
    nextSortSearch({ currentSort: "updated", currentOrder: "asc", clicked: "created" }),
  ).toEqual({ sort: "created", order: "desc" });
  expect(
    nextSortSearch({ currentSort: "created", currentOrder: "desc", clicked: "updated" }),
  ).toEqual({ sort: "updated", order: "desc" });
});

test("language requests section shows empty and rows", async () => {
  await using empty = await renderAdmin(
    <LanguageRequestsSection
      requests={[]}
      hasNextPage={false}
      isFetchingNextPage={false}
      onLoadMore={() => undefined}
    />,
  );
  expect(empty.getByText("No language requests yet")).toBeTruthy();

  await using filled = await renderAdmin(
    <LanguageRequestsSection
      hasNextPage={false}
      isFetchingNextPage={false}
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

test("babies section sorts via clickable header links", async () => {
  await using view = await renderAdmin(
    <BabiesSection
      sort="updated"
      order="desc"
      tab="babies"
      hideDemo={true}
      hasNextPage={false}
      isFetchingNextPage={false}
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

  const created = view.getByRole("link", { name: "Created" });
  const updated = view.getByRole("link", { name: "Updated" });
  expect(created.getAttribute("href")).toContain("sort=created");
  expect(created.getAttribute("href")).toContain("order=desc");
  expect(created.getAttribute("href")).toContain("hideDemo=true");
  expect(updated.getAttribute("href")).toContain("sort=updated");
  expect(updated.getAttribute("href")).toContain("order=asc");
});

test("babies section shows a spinner while loading more", async () => {
  await using loadingMore = await renderAdmin(
    <BabiesSection
      sort="created"
      order="desc"
      tab="babies"
      hideDemo={true}
      hasNextPage={true}
      isFetchingNextPage={true}
      onLoadMore={() => undefined}
      babies={[{ ...sampleBaby, demo: false, managerEmails: [] }]}
    />,
  );
  expect(loadingMore.getByText("Avery")).toBeTruthy();
  expect(loadingMore.getAllByRole("status", { name: "Loading" }).length).toBeGreaterThan(0);
});

test("language requests section shows loading-more spinner", async () => {
  await using view = await renderAdmin(
    <LanguageRequestsSection
      hasNextPage={true}
      isFetchingNextPage={true}
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

  await using _view = await renderAdmin(
    <BabiesSection
      sort="updated"
      order="desc"
      tab="babies"
      hideDemo={true}
      hasNextPage={true}
      isFetchingNextPage={false}
      onLoadMore={onLoadMore}
      babies={[sampleBaby]}
    />,
  );

  expect(onLoadMore).toHaveBeenCalled();
  expect(observers.length).toBeGreaterThan(0);
  globalThis.IntersectionObserver = OriginalObserver;
});

test("admin dashboard page exposes tab links and hide-demo filter", async () => {
  const onTabChange = vi.fn<(tab: "babies" | "languages") => void>();
  const onHideDemoChange = vi.fn<(hideDemo: boolean) => void>();

  await using view = await renderAdmin(
    <AdminDashboardView
      tab="babies"
      sort="updated"
      order="desc"
      hideDemo={true}
      onTabChange={onTabChange}
      onHideDemoChange={onHideDemoChange}
      babiesTab={<div>babies body</div>}
      languagesTab={<div>languages body</div>}
    />,
  );
  expect(view.getByText("Admin dashboard")).toBeTruthy();

  const babiesTab = view.getByRole("tab", { name: "All babies" });
  const languagesTab = view.getByRole("tab", { name: "Requested languages" });
  expect(babiesTab.tagName).toBe("A");
  expect(languagesTab.tagName).toBe("A");
  expect(babiesTab.getAttribute("href")).toContain("tab=babies");
  expect(languagesTab.getAttribute("href")).toContain("tab=languages");

  const hideDemo = view.getByRole("switch", { name: "Hide demo babies" });
  expect(hideDemo.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(hideDemo);
  expect(onHideDemoChange).toHaveBeenCalledWith(false);

  fireEvent.click(languagesTab);
  // Tab Links navigate via href; onValueChange also fires for the Tabs control.
  expect(onTabChange).toHaveBeenCalled();
});

const ADMIN_EMPTY_PAGE = { page: [], isDone: true, continueCursor: "" };

function makeAdminLoaderQueryClient(handlers: Record<string, unknown>) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: (ctx) => {
          const name = String(ctx.queryKey[1]);
          if (name in handlers) {
            return Promise.resolve(handlers[name]);
          }
          return Promise.resolve(null);
        },
      },
    },
  });
}

async function runAdminLoader(
  handlers: Record<string, unknown>,
  profile: { locale: string; timeZone: string; isAdmin: boolean },
) {
  const { registerConvexInfiniteQueryClient } = await import("@workspace/convex-prefetch");
  registerConvexInfiniteQueryClient({
    convexClient: { query: () => Promise.resolve(ADMIN_EMPTY_PAGE) },
    serverHttpClient: undefined,
  } as never);
  const route = AdminRoute as unknown as {
    options: {
      loader: (opts: {
        context: {
          queryClient: QueryClient;
          convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
          profile: { input: Record<string, never>; initialData: typeof profile };
        };
        deps: { tab: string; sort: string; order: string; hideDemo: boolean };
      }) => Promise<Record<string, unknown>>;
    };
  };
  const queryClient = makeAdminLoaderQueryClient(handlers);
  return await route.options.loader({
    context: {
      queryClient,
      convexPreloader: getConvexQueryPreloader(queryClient),
      profile: { input: {}, initialData: profile },
    },
    deps: { tab: "babies", sort: "updated", order: "desc", hideDemo: true },
  });
}

test("loader prefetches babies and language requests in parallel for admins", async () => {
  const result = await runAdminLoader(
    {
      "admin:listBabies": ADMIN_EMPTY_PAGE,
      "admin:listLanguageRequests": ADMIN_EMPTY_PAGE,
    },
    { locale: "en-GB", timeZone: "Europe/London", isAdmin: true },
  );

  expect(result.babies).toMatchObject({
    input: { sortBy: "updated", sortOrder: "desc", hideDemo: true },
    numItems: 20,
  });
  expect(result.languages).toMatchObject({ input: {}, numItems: 20 });
});

test("loader redirects non-admins without prefetching admin queries", async () => {
  try {
    await runAdminLoader(
      {
        "admin:listBabies": () => {
          throw new Error("admin:listBabies should not run for non-admins");
        },
        "admin:listLanguageRequests": () => {
          throw new Error("admin:listLanguageRequests should not run for non-admins");
        },
      },
      { locale: "en-GB", timeZone: "Europe/London", isAdmin: false },
    );
    expect.unreachable("expected a redirect");
  } catch (error) {
    expect(isRedirect(error)).toBe(true);
    if (isRedirect(error)) {
      expect(error.options.to).toBe("/dashboard");
    }
  }
});
