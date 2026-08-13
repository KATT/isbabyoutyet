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
      preload: string | undefined;
    },
  ) => {
    const href =
      props.to === "/baby/$publicId" && props.params
        ? `/baby/${props.params.publicId}`
        : typeof props.to === "string"
          ? props.to
          : "#";
    return (
      <a href={href} data-preload={props.preload} {...props}>
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

async function openDevBar() {
  fireEvent.click(screen.getByRole("button", { name: /developer shortcuts/i }));
  await vi.waitFor(() => {
    expect(screen.getByRole("menu")).toBeTruthy();
  });
}

test("opens a menu of seeded baby shortcuts with viewport preload", async () => {
  mocks.pathname = "/dashboard";
  mocks.hasDemoLogin = true;

  await using _view = renderDevBar();

  expect(screen.queryByRole("menuitem", { name: /not yet/i })).toBeNull();
  await openDevBar();

  for (const baby of DEMO_BABIES) {
    const link = screen.getByRole("menuitem", { name: new RegExp(baby.label, "i") });
    expect(link.getAttribute("href")).toBe(`/baby/${baby.publicId}`);
    expect(link.getAttribute("data-preload")).toBe("viewport");
  }

  const juniper = screen.getByRole("menuitem", {
    name: new RegExp(HOMEPAGE_DEMO_BABIES["en-GB"].name, "i"),
  });
  expect(juniper.getAttribute("href")).toBe(`/baby/${HOMEPAGE_DEMO_BABIES["en-GB"].publicId}`);
  expect(juniper.getAttribute("data-preload")).toBe("viewport");
});

test("hides entirely when demo login is disabled", async () => {
  mocks.hasDemoLogin = false;
  mocks.pathname = "/";

  await using _view = renderDevBar();

  expect(screen.queryByRole("button", { name: /developer shortcuts/i })).toBeNull();
});

test("closes when the route changes", async () => {
  mocks.pathname = "/dashboard";
  mocks.hasDemoLogin = true;

  await using view = renderDevBar();
  await openDevBar();

  mocks.pathname = "/baby/baby-waiting";
  view.rerender(<DevBar />);

  await vi.waitFor(() => {
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

test("page shortcut links also preload", async () => {
  mocks.pathname = "/";
  mocks.hasDemoLogin = true;

  await using _view = renderDevBar();
  await openDevBar();

  for (const name of ["Dashboard", "Login", "Preview"]) {
    expect(screen.getByRole("menuitem", { name: new RegExp(name, "i") }).getAttribute("data-preload")).toBe(
      "viewport",
    );
  }
});
