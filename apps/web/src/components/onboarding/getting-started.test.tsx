import { fireEvent, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { GettingStartedCard } from "@/components/onboarding/getting-started";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";

test("shows the next incomplete step and an add-baby CTA on the dashboard", async () => {
  const onAcknowledge = vi.fn<(stepId: string) => void>();
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={[]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={onAcknowledge}
      surface="dashboard"
      onGoToStep={undefined}
      className={undefined}
      tourBaby={null}
    />,
  );

  expect(screen.getAllByText("Add your first baby").length).toBeGreaterThan(0);
  expect(screen.getAllByRole("link", { name: /add a baby/i }).length).toBeGreaterThan(0);
});

test("dashboard share step links to the first baby's page", async () => {
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={["add_baby"]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={vi.fn<(stepId: string) => void>()}
      surface="dashboard"
      onGoToStep={undefined}
      className={undefined}
      tourBaby={{ publicId: "baby-waiting", name: "Ada" }}
    />,
  );

  const links = screen.getAllByRole("link", { name: /open ada's page/i });
  expect(links.length).toBeGreaterThan(0);
  expect(links[0]?.getAttribute("href")).toContain("baby-waiting");
});

test("minimized chip shows progress count", async () => {
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={["add_baby", "share_link"]}
      minimized
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={vi.fn<() => void>()}
      surface="baby"
      onGoToStep={undefined}
      className={undefined}
      tourBaby={{ publicId: "baby-waiting", name: "Ada" }}
    />,
  );

  expect(screen.getByRole("button", { name: /2 of 5 done/i })).toBeTruthy();
});

test("learn_encouragements shows a Got it button that acknowledges the step", async () => {
  const onAcknowledge = vi.fn<(stepId: string) => void>();
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={["add_baby", "share_link", "post_update", "explore_settings"]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={onAcknowledge}
      surface="baby"
      onGoToStep={undefined}
      className={undefined}
      tourBaby={{ publicId: "baby-waiting", name: "Ada" }}
    />,
  );

  fireEvent.click(screen.getAllByRole("button", { name: /got it/i })[0]!);
  expect(onAcknowledge).toHaveBeenCalledWith("learn_encouragements");
});

test("dashboard settings CTA marks the step done while opening the page", async () => {
  const onAcknowledge = vi.fn<(stepId: string) => void>();
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={["add_baby", "share_link", "post_update"]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={onAcknowledge}
      surface="dashboard"
      onGoToStep={undefined}
      className={undefined}
      tourBaby={{ publicId: "baby-waiting", name: "Ada" }}
    />,
  );

  fireEvent.click(screen.getAllByRole("link", { name: /open settings/i })[0]!);
  expect(onAcknowledge).toHaveBeenCalledWith("explore_settings");
});

test("baby-page checklist can open post update and settings", async () => {
  const onGoToStep = vi.fn<(stepId: string) => void>();
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={["add_baby", "share_link"]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={vi.fn<(stepId: string) => void>()}
      className={undefined}
      onGoToStep={onGoToStep}
      surface="baby"
      tourBaby={{ publicId: "baby-waiting", name: "Ada" }}
    />,
  );

  fireEvent.click(screen.getAllByRole("button", { name: /post an update/i })[0]!);
  expect(onGoToStep).toHaveBeenCalledWith("post_update");

  fireEvent.click(screen.getAllByRole("button", { name: /open settings/i })[0]!);
  expect(onGoToStep).toHaveBeenCalledWith("explore_settings");
});

test("all-done state offers close checklist", async () => {
  const onDismiss = vi.fn<() => void>();
  await using _view = await renderWithTestRouter(
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
      onGoToStep={undefined}
      className={undefined}
      tourBaby={{ publicId: "baby-waiting", name: "Ada" }}
    />,
  );

  expect(screen.getByText(/you're all set/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /close checklist/i }));
  expect(onDismiss).toHaveBeenCalledOnce();
});
