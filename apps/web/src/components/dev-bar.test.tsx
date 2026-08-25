import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { DEMO_BABIES, HOMEPAGE_DEMO_BABIES } from "@workspace/convex/src/seedCredentials";
import { DevBar } from "@/components/dev-bar";

async function renderDevBarAt(pathname: string) {
  const history = createMemoryHistory({ initialEntries: [pathname] });
  const rootRoute = createRootRoute({
    component: () => <DevBar enabled={true} />,
  });
  const router = createRouter({
    routeTree: rootRoute,
    history,
    defaultPendingMinMs: 0,
  });
  await router.load();

  const view = render(<RouterProvider router={router} />);
  return {
    history,
    view: makeResource(view, () => {
      view.unmount();
    }),
  };
}

async function openDevBar() {
  fireEvent.click(screen.getByRole("button", { name: /developer shortcuts/i }));
  await vi.waitFor(() => {
    expect(screen.getByRole("menu")).toBeTruthy();
  });
}

test("opens a menu of seeded baby shortcuts", async () => {
  const rendered = await renderDevBarAt("/dashboard");
  await using _view = rendered.view;

  expect(screen.queryByRole("menuitem", { name: /not yet/i })).toBeNull();
  await openDevBar();

  for (const baby of DEMO_BABIES) {
    const link = screen.getByRole("menuitem", { name: new RegExp(baby.label, "i") });
    expect(link.getAttribute("href")).toBe(`/baby/${baby.publicId}`);
  }

  const juniper = screen.getByRole("menuitem", {
    name: new RegExp(HOMEPAGE_DEMO_BABIES["en-GB"].name, "i"),
  });
  expect(juniper.getAttribute("href")).toBe(`/baby/${HOMEPAGE_DEMO_BABIES["en-GB"].publicId}`);
});

test("hides entirely when disabled", () => {
  const view = render(<DevBar enabled={false} />);
  using _view = makeResource(view, () => {
    view.unmount();
  });

  expect(view.queryByRole("button", { name: /developer shortcuts/i })).toBeNull();
});

test("closes when the route changes", async () => {
  const rendered = await renderDevBarAt("/dashboard");
  await using _view = rendered.view;
  await openDevBar();

  act(() => {
    void rendered.history.push("/baby/baby-waiting");
  });

  await vi.waitFor(() => {
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

test("page shortcut links point at dashboard, login, and preview", async () => {
  const rendered = await renderDevBarAt("/");
  await using _view = rendered.view;
  await openDevBar();

  expect(screen.getByRole("menuitem", { name: /dashboard/i }).getAttribute("href")).toBe(
    "/dashboard",
  );
  expect(screen.getByRole("menuitem", { name: /login/i }).getAttribute("href")).toBe("/auth/login");
  expect(screen.getByRole("menuitem", { name: /preview/i }).getAttribute("href")).toBe("/preview");
});

test("marks the current baby when opened on a baby page", async () => {
  const rendered = await renderDevBarAt("/baby/baby-in-labor");
  await using _view = rendered.view;
  await openDevBar();

  expect(screen.getByRole("menuitem", { name: /labour started/i })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: /not yet/i })).toBeTruthy();
});

test("covers page active states for dashboard, login, and preview", async () => {
  {
    const dashboard = await renderDevBarAt("/dashboard");
    await using _dashboard = dashboard.view;
    await openDevBar();
    expect(screen.getByRole("menuitem", { name: /dashboard/i })).toBeTruthy();
  }

  {
    const login = await renderDevBarAt("/auth/login");
    await using _login = login.view;
    await openDevBar();
    expect(screen.getByRole("menuitem", { name: /login/i })).toBeTruthy();
  }

  {
    const preview = await renderDevBarAt("/preview");
    await using _preview = preview.view;
    await openDevBar();
    expect(screen.getByRole("menuitem", { name: /preview/i })).toBeTruthy();
  }
});

test("marks the current homepage demo baby", async () => {
  const rendered = await renderDevBarAt(`/baby/${HOMEPAGE_DEMO_BABIES["en-GB"].publicId}`);
  await using _view = rendered.view;
  await openDevBar();

  expect(
    screen.getByRole("menuitem", { name: new RegExp(HOMEPAGE_DEMO_BABIES["en-GB"].name, "i") }),
  ).toBeTruthy();
});
