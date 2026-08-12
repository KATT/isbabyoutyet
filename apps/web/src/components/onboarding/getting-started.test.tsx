import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { GettingStartedCard } from "./getting-started";

vi.mock("@tanstack/react-router", () => ({
  Link: (props: React.ComponentProps<"a"> & { to?: string }) => (
    <a href={typeof props.to === "string" ? props.to : "#"} {...props} />
  ),
}));

function renderResource(ui: React.ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("shows the next incomplete step and an add-baby CTA on the dashboard", async () => {
  const onAcknowledge = vi.fn<(stepId: string) => void>();
  await using _view = renderResource(
    <GettingStartedCard
      effectiveSteps={[]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={onAcknowledge}
      surface="dashboard"
    />,
  );

  expect(screen.getAllByText("Add your first baby").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /add a baby/i })).toBeTruthy();
});

test("minimized chip shows progress count", async () => {
  await using _view = renderResource(
    <GettingStartedCard
      effectiveSteps={["add_baby", "share_link"]}
      minimized
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={vi.fn<() => void>()}
      surface="baby"
    />,
  );

  expect(screen.getByRole("button", { name: /2 of 5 done/i })).toBeTruthy();
});

test("learn_encouragements shows a Got it button that acknowledges the step", async () => {
  const onAcknowledge = vi.fn<(stepId: string) => void>();
  await using _view = renderResource(
    <GettingStartedCard
      effectiveSteps={["add_baby", "share_link", "post_update", "explore_settings"]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={onAcknowledge}
      surface="baby"
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /got it/i }));
  expect(onAcknowledge).toHaveBeenCalledWith("learn_encouragements");
});

test("all-done state offers close checklist", async () => {
  const onDismiss = vi.fn<() => void>();
  await using _view = renderResource(
    <GettingStartedCard
      effectiveSteps={[
        "add_baby",
        "share_link",
        "post_update",
        "explore_settings",
        "learn_encouragements",
      ]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={onDismiss}
      onAcknowledgeStep={vi.fn<() => void>()}
      surface="baby"
    />,
  );

  expect(screen.getByText(/you're all set/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /close checklist/i }));
  expect(onDismiss).toHaveBeenCalledOnce();
});
