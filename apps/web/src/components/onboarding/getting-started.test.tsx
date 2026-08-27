import { act, fireEvent, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { GettingStartedCard } from "./getting-started";

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
  expect(screen.getAllByText(/choose a journey/i).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("link", { name: /add a baby/i }).length).toBeGreaterThan(0);
});

test("keeps mobile first-use guidance compact until the user opens the checklist", async () => {
  const onDismiss = vi.fn<() => void>();
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={[]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={onDismiss}
      onAcknowledgeStep={vi.fn<(stepId: string) => void>()}
      surface="dashboard"
      onGoToStep={undefined}
      className={undefined}
      tourBaby={null}
    />,
  );

  const expand = screen.getByRole("button", {
    name: /getting started: 0 of 5 done. expand/i,
  });
  const mobileDock = screen.getAllByRole("complementary", {
    name: "Getting started checklist",
  })[0];
  if (!mobileDock) {
    throw new Error("Expected a compact mobile guide");
  }
  expect(within(mobileDock).queryByRole("link", { name: /add a baby/i })).toBeNull();
  fireEvent.click(expand);

  const drawer = await screen.findByRole("dialog", { name: "Getting started" });
  expect(within(drawer).getByText("Tap a step to jump there")).toBeTruthy();
  expect(within(drawer).getByRole("button", { name: "Dismiss guide" })).toBeTruthy();
  fireEvent.click(within(drawer).getByRole("button", { name: /close checklist/i }));
  await vi.waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Getting started" })).toBeNull();
  });
  expect(onDismiss).not.toHaveBeenCalled();

  fireEvent.click(expand);
  const reopenedDrawer = await screen.findByRole("dialog", { name: "Getting started" });
  fireEvent.click(within(reopenedDrawer).getByRole("button", { name: "Dismiss guide" }));
  await vi.waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Getting started" })).toBeNull();
  });
  expect(onDismiss).toHaveBeenCalledOnce();
});

test("dismisses the guide from the explicit labeled action", async () => {
  const onDismiss = vi.fn<() => void>();
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={[]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={onDismiss}
      onAcknowledgeStep={vi.fn<(stepId: string) => void>()}
      surface="dashboard"
      onGoToStep={undefined}
      className={undefined}
      tourBaby={null}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Dismiss guide" }));
  expect(onDismiss).toHaveBeenCalledOnce();
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("anchors the mobile dock and drawer to the visual viewport", async () => {
  const innerHeightDescriptor = Object.getOwnPropertyDescriptor(window, "innerHeight");
  const visualViewportDescriptor = Object.getOwnPropertyDescriptor(window, "visualViewport");
  await using _viewport = makeResource({}, () => {
    if (innerHeightDescriptor) {
      Object.defineProperty(window, "innerHeight", innerHeightDescriptor);
    } else {
      Reflect.deleteProperty(window, "innerHeight");
    }
    if (visualViewportDescriptor) {
      Object.defineProperty(window, "visualViewport", visualViewportDescriptor);
    } else {
      Reflect.deleteProperty(window, "visualViewport");
    }
  });

  const visualViewport = Object.assign(new EventTarget(), {
    height: 844,
    width: 390,
    offsetLeft: 0,
    offsetTop: 0,
  }) as VisualViewport;
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 959 });
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: visualViewport,
  });

  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={[]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={vi.fn<(stepId: string) => void>()}
      surface="dashboard"
      onGoToStep={undefined}
      className={undefined}
      tourBaby={null}
    />,
  );

  const mobileDock = screen.getAllByRole("complementary", {
    name: "Getting started checklist",
  })[0];
  expect(mobileDock?.style.getPropertyValue("--visual-viewport-bottom")).toBe("115px");

  fireEvent.click(
    screen.getByRole("button", {
      name: /getting started: 0 of 5 done. expand/i,
    }),
  );
  await screen.findByRole("dialog", { name: "Getting started" });
  const drawer = document.querySelector<HTMLElement>('[data-slot="drawer-popup"]');
  expect(drawer?.style.bottom).toBe("115px");
  expect(drawer?.style.left).toBe("0px");
  expect(drawer?.style.width).toBe("390px");

  Object.defineProperty(visualViewport, "height", { configurable: true, value: 800 });
  act(() => {
    visualViewport.dispatchEvent(new Event("resize"));
  });
  expect(mobileDock?.style.getPropertyValue("--visual-viewport-bottom")).toBe("159px");
});

test("dashboard baby-page steps link to the preferred baby's page (not overlays)", async () => {
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

  const links = screen.getAllByRole("link", { name: /see ada's page/i });
  expect(links.length).toBeGreaterThan(0);
  expect(links[0]?.getAttribute("href")).toBe("/baby/baby-waiting");
});

test("dashboard post-update step links to the preferred baby's page", async () => {
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={["add_baby", "share_link"]}
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

  const links = screen.getAllByRole("link", { name: /see ada's page/i });
  expect(links.length).toBeGreaterThan(0);
  expect(links[0]?.getAttribute("href")).toBe("/baby/baby-waiting");
});

test("baby-page Show me is a no-op when onGoToStep is missing", async () => {
  const onAcknowledge = vi.fn<(stepId: string) => void>();
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={["add_baby"]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={onAcknowledge}
      surface="baby"
      onGoToStep={undefined}
      className={undefined}
      tourBaby={null}
    />,
  );

  fireEvent.click(screen.getAllByRole("button", { name: /show me/i })[0]!);
  expect(onAcknowledge).not.toHaveBeenCalled();
});

test("baby-page share step highlights via Show me", async () => {
  const onGoToStep = vi.fn<(stepId: string) => void>();
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={["add_baby"]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={vi.fn<(stepId: string) => void>()}
      surface="baby"
      onGoToStep={onGoToStep}
      className={undefined}
      tourBaby={{ publicId: "baby-waiting", name: "Ada" }}
    />,
  );

  fireEvent.click(screen.getAllByRole("button", { name: /show me/i })[0]!);
  expect(onGoToStep).toHaveBeenCalledWith("share_link");
});

test("minimized chip shows progress count", async () => {
  const onMinimize = vi.fn<(minimized: boolean) => void>();
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={["add_baby", "share_link"]}
      minimized
      onMinimize={onMinimize}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={vi.fn<() => void>()}
      surface="baby"
      onGoToStep={undefined}
      className={undefined}
      tourBaby={{ publicId: "baby-waiting", name: "Ada" }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /2 of 5 done/i }));
  expect(onMinimize).toHaveBeenCalledWith(false);
});

test("dashboard settings CTA opens the preferred baby's page without completing", async () => {
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

  fireEvent.click(screen.getAllByRole("link", { name: /see ada's page/i })[0]!);
  expect(onAcknowledge).not.toHaveBeenCalled();
});

test("baby-page checklist uses Show me for post and settings tips", async () => {
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

  fireEvent.click(screen.getAllByRole("button", { name: /show me/i })[0]!);
  expect(onGoToStep).toHaveBeenCalledWith("post_update");
});

test("baby-page Show me works without a preferred tour baby", async () => {
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
      tourBaby={null}
    />,
  );

  fireEvent.click(screen.getAllByRole("button", { name: /show me/i })[0]!);
  expect(onGoToStep).toHaveBeenCalledWith("post_update");
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

  expect(screen.getAllByText(/you're all set/i)).toHaveLength(2);
  const closeButton = screen.getAllByRole("button", { name: /close checklist/i })[0];
  if (!closeButton) {
    throw new Error("Expected a close checklist button");
  }
  fireEvent.click(closeButton);
  expect(onDismiss).toHaveBeenCalledOnce();
});

test("dashboard learn encouragements step links to the first baby's page", async () => {
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={["add_baby", "share_link", "post_update", "explore_settings"]}
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

  const links = screen.getAllByRole("link", { name: /see ada's page/i });
  expect(links.length).toBeGreaterThan(0);
  expect(links[0]?.getAttribute("href")).toContain("baby-waiting");
});

test("baby-page learn encouragements opens the highlight tip via Show me", async () => {
  const onGoToStep = vi.fn<(stepId: string) => void>();
  const onAcknowledge = vi.fn<(stepId: string) => void>();
  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={["add_baby", "share_link", "post_update", "explore_settings"]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={onAcknowledge}
      surface="baby"
      onGoToStep={onGoToStep}
      className={undefined}
      tourBaby={{ publicId: "baby-waiting", name: "Ada" }}
    />,
  );

  fireEvent.click(screen.getAllByRole("button", { name: /show me/i })[0]!);
  expect(onGoToStep).toHaveBeenCalledWith("learn_encouragements");
  expect(onAcknowledge).not.toHaveBeenCalled();
});

test("next-step hint Show me runs the baby-page highlight action", async () => {
  const onGoToStep = vi.fn<(stepId: string) => void>();

  await using _view = await renderWithTestRouter(
    <GettingStartedCard
      effectiveSteps={["add_baby", "share_link", "post_update", "explore_settings"]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={vi.fn<(stepId: string) => void>()}
      surface="baby"
      onGoToStep={onGoToStep}
      className={undefined}
      tourBaby={{ publicId: "baby-waiting", name: "Ada" }}
    />,
  );

  const showMeButtons = screen.getAllByRole("button", { name: /show me/i });
  expect(showMeButtons.length).toBeGreaterThan(1);
  fireEvent.click(showMeButtons[1]!);
  expect(onGoToStep).toHaveBeenCalledWith("learn_encouragements");
});

test("next-step hint Open settings acknowledges from the dashboard panel", async () => {
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

  const hintTitles = screen.getAllByText("Peek at settings");
  expect(hintTitles.length).toBeGreaterThan(0);
  const hintPanel = hintTitles[hintTitles.length - 1]!.closest("div.rounded-lg");
  expect(hintPanel).toBeTruthy();
  const settingsInHint =
    within(hintPanel as HTMLElement).queryByRole("link", { name: /open settings/i }) ||
    within(hintPanel as HTMLElement).getByRole("button", { name: /open settings/i });
  onAcknowledge.mockClear();
  fireEvent.click(settingsInHint);
  expect(onAcknowledge).toHaveBeenCalledWith("explore_settings");
});
