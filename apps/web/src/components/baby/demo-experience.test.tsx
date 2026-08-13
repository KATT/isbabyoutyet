import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { DemoExperience } from "./demo-experience";

vi.mock("@tanstack/react-router", () => ({
  Link: (props: React.ComponentProps<"a"> & { to: string }) => (
    <a href={props.to}>{props.children}</a>
  ),
}));

vi.mock("@/components/onboarding/welcome-tour", () => ({
  WelcomeTourDialog: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onFinished: () => void;
  }) =>
    props.open ? (
      <div>
        <p>Welcome to the demo playground</p>
        <button
          type="button"
          onClick={() => {
            props.onFinished();
            props.onOpenChange(false);
          }}
        >
          Skip
        </button>
      </div>
    ) : null,
}));

function renderResource(ui: React.ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("orients a guest once and exposes settings and signup actions", async () => {
  await using _storage = makeResource({}, () => localStorage.clear());
  const onOpenSettings = vi.fn<() => void>();

  {
    await using _view = renderResource(
      <DemoExperience kind="source" sourceBabyId="source-1" onOpenSettings={onOpenSettings} />,
    );
    expect(screen.getByText("Welcome to the demo playground")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  }

  await using _view = renderResource(
    <DemoExperience kind="source" sourceBabyId="source-1" onOpenSettings={onOpenSettings} />,
  );
  expect(screen.queryByText("Welcome to the demo playground")).toBeNull();
  expect(screen.getByText("This is a demo source")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try settings" }));
  expect(onOpenSettings).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "Create your own" }).getAttribute("href")).toBe(
    "/auth/signup",
  );
});

test("playground notice explains browser ownership and four-day cleanup", async () => {
  await using _storage = makeResource({}, () => localStorage.clear());
  localStorage.setItem("demo-onboarding:source-1", "done");

  await using _view = renderResource(
    <DemoExperience
      kind="playground"
      sourceBabyId="source-1"
      onOpenSettings={vi.fn<() => void>()}
    />,
  );
  expect(screen.getByText("This is your demo playground")).toBeTruthy();
  expect(screen.getByText(/Only this browser can edit it/)).toBeTruthy();
});
