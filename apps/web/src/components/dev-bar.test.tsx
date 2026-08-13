import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { DEMO_BABIES, HOMEPAGE_DEMO_BABIES } from "@workspace/convex/src/seedCredentials";

const mocks = vi.hoisted(() => ({
  pathname: "/dashboard",
  hasDemoLogin: true,
}));

vi.mock("@/lib/has-demo-login", () => ({
  get hasDemoLogin() {
    return mocks.hasDemoLogin;
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: (
    props: React.ComponentProps<"a"> & {
      to: string | undefined;
      params: { publicId: string } | undefined;
    },
  ) => {
    const href =
      props.to === "/baby/$publicId" && props.params
        ? `/baby/${props.params.publicId}`
        : typeof props.to === "string"
          ? props.to
          : "#";
    return (
      <a href={href} {...props}>
        {props.children}
      </a>
    );
  },
  useRouterState: (opts: { select: (state: { location: { pathname: string } }) => string }) =>
    opts.select({ location: { pathname: mocks.pathname } }),
}));

const { DevBar } = await import("./dev-bar");

function renderDevBar() {
  const view = render(<DevBar />);
  return makeResource(view, () => {
    view.unmount();
  });
}

async function expandDevBar() {
  fireEvent.click(screen.getByRole("button", { name: /expand developer shortcuts/i }));
  await vi.waitFor(() => {
    expect(screen.getByRole("complementary", { name: /developer shortcuts/i })).toBeTruthy();
  });
}

test("starts collapsed and expands to show seeded baby shortcuts", async () => {
  mocks.pathname = "/dashboard";
  mocks.hasDemoLogin = true;

  await using _view = renderDevBar();

  expect(screen.queryByRole("link", { name: /not yet/i })).toBeNull();
  await expandDevBar();

  for (const baby of DEMO_BABIES) {
    const link = screen.getByRole("link", { name: new RegExp(baby.label, "i") });
    expect(link.getAttribute("href")).toBe(`/baby/${baby.publicId}`);
  }

  const juniper = screen.getByRole("link", {
    name: new RegExp(HOMEPAGE_DEMO_BABIES["en-GB"].name, "i"),
  });
  expect(juniper.getAttribute("href")).toBe(`/baby/${HOMEPAGE_DEMO_BABIES["en-GB"].publicId}`);
});

test("hides entirely when demo login is disabled", async () => {
  mocks.hasDemoLogin = false;
  mocks.pathname = "/";

  await using _view = renderDevBar();

  expect(screen.queryByRole("button", { name: /expand developer shortcuts/i })).toBeNull();
  expect(screen.queryByRole("complementary", { name: /developer shortcuts/i })).toBeNull();
});

test("marks the current baby link as the active page", async () => {
  mocks.pathname = "/baby/baby-in-labor";
  mocks.hasDemoLogin = true;

  await using _view = renderDevBar();
  await expandDevBar();

  expect(screen.getByRole("link", { name: /labour started/i }).getAttribute("aria-current")).toBe(
    "page",
  );
  expect(screen.getByRole("link", { name: /not yet/i }).getAttribute("aria-current")).toBeNull();
});

test("closes when the route changes", async () => {
  mocks.pathname = "/dashboard";
  mocks.hasDemoLogin = true;

  await using view = renderDevBar();
  await expandDevBar();

  mocks.pathname = "/baby/baby-waiting";
  view.rerender(<DevBar />);

  await vi.waitFor(() => {
    expect(screen.queryByRole("complementary", { name: /developer shortcuts/i })).toBeNull();
  });
  expect(screen.getByRole("button", { name: /expand developer shortcuts/i })).toBeTruthy();
});

test("closes when clicking outside the bar", async () => {
  mocks.pathname = "/";
  mocks.hasDemoLogin = true;

  await using _view = renderDevBar();
  await expandDevBar();

  fireEvent.pointerDown(document.body);

  await vi.waitFor(() => {
    expect(screen.queryByRole("complementary", { name: /developer shortcuts/i })).toBeNull();
  });
});

test("stays open when clicking inside the bar", async () => {
  mocks.pathname = "/";
  mocks.hasDemoLogin = true;

  await using _view = renderDevBar();
  await expandDevBar();

  fireEvent.pointerDown(screen.getByRole("complementary", { name: /developer shortcuts/i }));

  expect(screen.getByRole("complementary", { name: /developer shortcuts/i })).toBeTruthy();
});

test("closes when pressing Escape", async () => {
  mocks.pathname = "/";
  mocks.hasDemoLogin = true;

  await using _view = renderDevBar();
  await expandDevBar();

  fireEvent.keyDown(document, { key: "Escape" });

  await vi.waitFor(() => {
    expect(screen.queryByRole("complementary", { name: /developer shortcuts/i })).toBeNull();
  });
});
