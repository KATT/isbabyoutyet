import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { GettingStartedCard } from "./getting-started";

vi.mock("@tanstack/react-router", () => ({
  Link: (
    props: React.ComponentProps<"a"> & {
      to: string | undefined;
      params: { publicId: string | undefined } | undefined;
      search: { settings: boolean | undefined; postUpdate: boolean | undefined } | undefined;
    },
  ) => {
    const href =
      typeof props.to === "string"
        ? props.to.replace("$publicId", props.params?.publicId ?? "")
        : "#";
    return (
      <a href={href} aria-label={props["aria-label"]} onClick={props.onClick}>
        {props.children}
      </a>
    );
  },
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
  await using _view = renderResource(
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
  await using _view = renderResource(
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

  await using _view = renderResource(
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

test("dashboard share step links to the first baby's page", async () => {
  await using _view = renderResource(
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
  const onMinimize = vi.fn<(minimized: boolean) => void>();
  await using _view = renderResource(
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

test("dashboard settings CTA marks the step done while opening the page", async () => {
  const onAcknowledge = vi.fn<(stepId: string) => void>();
  await using _view = renderResource(
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

test("baby-page checklist links post update and can open settings", async () => {
  const onGoToStep = vi.fn<(stepId: string) => void>();
  await using _view = renderResource(
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

  const postLink = screen.getAllByRole("link", { name: /post an update/i })[0];
  expect(postLink?.getAttribute("href")).toContain("/baby/baby-waiting/post");

  fireEvent.click(screen.getAllByRole("button", { name: /open settings/i })[0]!);
  expect(onGoToStep).toHaveBeenCalledWith("explore_settings");
});

test("baby-page share action jumps to the share target", async () => {
  const onGoToStep = vi.fn<(stepId: string) => void>();
  await using _view = renderResource(
    <GettingStartedCard
      effectiveSteps={["add_baby"]}
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

  const shareButton = screen.getAllByRole("button", { name: "Show Share" })[0];
  if (!shareButton) {
    throw new Error("Expected a share guide action");
  }
  fireEvent.click(shareButton);
  expect(onGoToStep).toHaveBeenCalledWith("share_link");
});

test("baby-page post action stays unavailable until a tour baby exists", async () => {
  await using _view = renderResource(
    <GettingStartedCard
      effectiveSteps={["add_baby", "share_link"]}
      minimized={false}
      onMinimize={vi.fn<() => void>()}
      onDismiss={vi.fn<() => void>()}
      onAcknowledgeStep={vi.fn<(stepId: string) => void>()}
      className={undefined}
      onGoToStep={vi.fn<(stepId: string) => void>()}
      surface="baby"
      tourBaby={null}
    />,
  );

  expect(screen.queryByRole("link", { name: "Post an update" })).toBeNull();
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
  await using _view = renderResource(
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

test("baby-page learn encouragements acknowledges with Got it", async () => {
  const onAcknowledge = vi.fn<(stepId: string) => void>();
  await using _view = renderResource(
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
