import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { Coachmark } from "./coachmark";

function renderResource(ui: ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("scrolls the target into view and can hide the tip", async () => {
  const onDismiss = vi.fn<() => void>();
  const scrollIntoView = vi.fn<() => void>();
  const target = document.createElement("button");
  target.setAttribute("data-tour-id", "share_link");
  target.textContent = "Share";
  target.scrollIntoView = scrollIntoView;
  Object.defineProperty(target, "getBoundingClientRect", {
    value: () => ({ top: 40, left: 40, width: 80, height: 32, bottom: 72, right: 120 }),
  });
  document.body.appendChild(target);

  await using _view = renderResource(
    <Coachmark
      targetId="share_link"
      title="Share the link"
      description="Copy the page URL for family."
      onDismiss={onDismiss}
      completeOnDismiss={undefined}
      onComplete={undefined}
    />,
  );

  expect(scrollIntoView).toHaveBeenCalled();
  expect(screen.getByText("Share the link")).toBeTruthy();
  fireEvent.click(target);
  expect(onDismiss).toHaveBeenCalledOnce();
  onDismiss.mockClear();
  fireEvent.click(screen.getByRole("button", { name: /hide tip/i }));
  expect(onDismiss).toHaveBeenCalledOnce();

  target.remove();
});

test("Got it completes the step when completeOnDismiss is set", async () => {
  const onDismiss = vi.fn<() => void>();
  const onComplete = vi.fn<() => void>();
  const target = document.createElement("button");
  target.setAttribute("data-tour-id", "explore_settings");
  target.scrollIntoView = vi.fn<() => void>();
  Object.defineProperty(target, "getBoundingClientRect", {
    value: () => ({ top: 40, left: 40, width: 80, height: 32, bottom: 72, right: 120 }),
  });
  document.body.appendChild(target);

  await using _view = renderResource(
    <Coachmark
      targetId="explore_settings"
      title="Peek at settings"
      description="Themes, names, and language — all in Settings."
      onDismiss={onDismiss}
      completeOnDismiss
      onComplete={onComplete}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /got it/i }));
  expect(onComplete).toHaveBeenCalledOnce();
  expect(onDismiss).toHaveBeenCalledOnce();

  target.remove();
});

test("appears when its target mounts after the coachmark", async () => {
  await using _view = renderResource(
    <Coachmark
      targetId="late-target"
      title="Late target"
      description="Mounted after the coachmark."
      onDismiss={() => undefined}
      completeOnDismiss={undefined}
      onComplete={undefined}
    />,
  );
  expect(screen.queryByText("Late target")).toBeNull();

  const target = document.createElement("button");
  target.setAttribute("data-tour-id", "late-target");
  target.scrollIntoView = vi.fn<() => void>();
  Object.defineProperty(target, "getBoundingClientRect", {
    value: () => ({ top: 40, left: 40, width: 80, height: 32, bottom: 72, right: 120 }),
  });
  document.body.appendChild(target);
  await using _target = makeResource({}, () => target.remove());

  await vi.waitFor(() => {
    expect(screen.getByText("Late target")).toBeTruthy();
  });
});

test("hides the tip while the target has a zero-size rect", async () => {
  const target = document.createElement("button");
  target.setAttribute("data-tour-id", "collapsed-target");
  target.scrollIntoView = vi.fn<() => void>();
  let rect = { top: 40, left: 40, width: 0, height: 0, bottom: 40, right: 40 };
  Object.defineProperty(target, "getBoundingClientRect", {
    value: () => rect,
  });
  document.body.appendChild(target);
  await using _target = makeResource({}, () => target.remove());

  await using _view = renderResource(
    <Coachmark
      targetId="collapsed-target"
      title="Collapsed target"
      description="Should stay hidden until sized."
      onDismiss={() => undefined}
      completeOnDismiss={undefined}
      onComplete={undefined}
    />,
  );

  expect(screen.queryByText("Collapsed target")).toBeNull();

  rect = { top: 40, left: 40, width: 80, height: 32, bottom: 72, right: 120 };
  window.dispatchEvent(new Event("resize"));

  await vi.waitFor(() => {
    expect(screen.getByText("Collapsed target")).toBeTruthy();
  });

  rect = { top: 40, left: 40, width: 0, height: 0, bottom: 40, right: 40 };
  window.dispatchEvent(new Event("resize"));

  await vi.waitFor(() => {
    expect(screen.queryByText("Collapsed target")).toBeNull();
  });
});

test("uses a bounded mobile card on narrow viewports", async () => {
  const matchMediaDescriptor = Object.getOwnPropertyDescriptor(window, "matchMedia");
  await using _matchMedia = makeResource({}, () => {
    if (matchMediaDescriptor) {
      Object.defineProperty(window, "matchMedia", matchMediaDescriptor);
    } else {
      Reflect.deleteProperty(window, "matchMedia");
    }
  });
  const mediaQuery = {
    matches: true,
    media: "(max-width: 767px)",
    onchange: null,
    addListener: vi.fn<() => void>(),
    removeListener: vi.fn<() => void>(),
    addEventListener: vi.fn<() => void>(),
    removeEventListener: vi.fn<() => void>(),
    dispatchEvent: vi.fn<() => boolean>(() => true),
  } as MediaQueryList;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn<(query: string) => MediaQueryList>(() => mediaQuery),
  });

  const onDismiss = vi.fn<() => void>();
  const target = document.createElement("button");
  target.setAttribute("data-tour-id", "share_link");
  target.scrollIntoView = vi.fn<() => void>();
  Object.defineProperty(target, "getBoundingClientRect", {
    value: () => ({ top: 40, left: 40, width: 80, height: 32, bottom: 72, right: 120 }),
  });
  document.body.appendChild(target);
  await using _target = makeResource({}, () => target.remove());

  await using _view = renderResource(
    <Coachmark
      targetId="share_link"
      title="Share the link"
      description="Copy the page URL for family."
      onDismiss={onDismiss}
      completeOnDismiss={undefined}
      onComplete={undefined}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "Share the link" });
  await vi.waitFor(() => {
    expect(dialog.className).toContain("max-w-xs");
  });
  fireEvent.click(screen.getByRole("button", { name: /hide tip/i }));
  expect(onDismiss).toHaveBeenCalledOnce();
});
