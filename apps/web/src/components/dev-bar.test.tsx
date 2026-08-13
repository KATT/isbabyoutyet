import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { DEMO_BABIES, HOMEPAGE_DEMO_BABIES } from "@workspace/convex/src/seedCredentials";

const mocks = vi.hoisted(() => ({
  pathname: "/dashboard",
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

const { DevBarPanel } = await import("./dev-bar");

function renderDevBar() {
  const view = render(<DevBarPanel />);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("starts collapsed and expands to show seeded baby shortcuts", async () => {
  window.localStorage.removeItem("isbabyoutyet:dev-bar-expanded");
  mocks.pathname = "/dashboard";

  await using _view = renderDevBar();

  expect(screen.queryByRole("link", { name: /not yet/i })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /expand developer shortcuts/i }));

  for (const baby of DEMO_BABIES) {
    const link = screen.getByRole("link", { name: new RegExp(baby.label, "i") });
    expect(link.getAttribute("href")).toBe(`/baby/${baby.publicId}`);
  }

  const juniper = screen.getByRole("link", {
    name: new RegExp(HOMEPAGE_DEMO_BABIES["en-GB"].name, "i"),
  });
  expect(juniper.getAttribute("href")).toBe(`/baby/${HOMEPAGE_DEMO_BABIES["en-GB"].publicId}`);
});

test("marks the current baby link as the active page", async () => {
  window.localStorage.setItem("isbabyoutyet:dev-bar-expanded", "1");
  mocks.pathname = "/baby/baby-in-labor";

  await using _view = renderDevBar();

  await vi.waitFor(() => {
    expect(screen.getByRole("link", { name: /labour started/i }).getAttribute("aria-current")).toBe(
      "page",
    );
  });
  expect(screen.getByRole("link", { name: /not yet/i }).getAttribute("aria-current")).toBeNull();
});

test("collapsing persists the preference", async () => {
  window.localStorage.setItem("isbabyoutyet:dev-bar-expanded", "1");
  mocks.pathname = "/";

  await using _view = renderDevBar();

  await vi.waitFor(() => {
    expect(screen.getByRole("complementary", { name: /developer shortcuts/i })).toBeTruthy();
  });

  fireEvent.click(screen.getByRole("button", { name: /collapse developer shortcuts/i }));
  expect(window.localStorage.getItem("isbabyoutyet:dev-bar-expanded")).toBe("0");
  expect(screen.queryByRole("complementary", { name: /developer shortcuts/i })).toBeNull();
});
