import { act } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { renderResource } from "@/test/renderResource";
import {
  closeOverlayLink,
  dismissOverlay,
  openOverlayLink,
  useBabyPostOverlayNav,
} from "@/lib/overlay-nav";
import type { LinkProps } from "@tanstack/react-router";

type BabyPostOverlayNavRef = {
  current: ReturnType<typeof useBabyPostOverlayNav> | null;
};

test("openOverlayLink preloads through a real link and keeps overlay history", () => {
  expect(
    openOverlayLink({
      params: { publicId: "baby-smith" },
      to: "/baby/$publicId/post",
    }),
  ).toEqual({
    params: { publicId: "baby-smith" },
    preload: "viewport",
    resetScroll: false,
    state: { overlay: true },
    to: "/baby/$publicId/post",
  });
});

test("closeOverlayLink replaces to the close target without scroll reset", () => {
  expect(
    closeOverlayLink({
      params: { publicId: "baby-smith" },
      to: "/baby/$publicId",
    }),
  ).toEqual({
    params: { publicId: "baby-smith" },
    replace: true,
    resetScroll: false,
    to: "/baby/$publicId",
  });
});

test("dismissOverlay prefers history.back when the overlay was push-opened", () => {
  const back = vi.fn<() => void>();
  const navigate = vi.fn<(opts: LinkProps) => void>();
  const closeLink = closeOverlayLink({
    params: { publicId: "baby-smith" },
    to: "/baby/$publicId",
  });

  dismissOverlay({
    closeLink,
    history: {
      back,
      canGoBack: () => true,
      location: { state: { overlay: true } },
    },
    navigate,
  });

  expect(back).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
});

test("dismissOverlay navigates with closeLink without overlay history", () => {
  const back = vi.fn<() => void>();
  const navigate = vi.fn<(opts: LinkProps) => void>();
  const closeLink = closeOverlayLink({
    params: { publicId: "baby-smith" },
    to: "/baby/$publicId",
  });

  dismissOverlay({
    closeLink,
    history: {
      back,
      canGoBack: () => true,
      location: { state: { overlay: undefined } },
    },
    navigate,
  });

  expect(back).not.toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith(closeLink);
});

test("dismissOverlay navigates with closeLink when history cannot go back", () => {
  const back = vi.fn<() => void>();
  const navigate = vi.fn<(opts: LinkProps) => void>();
  const closeLink = closeOverlayLink({
    params: { publicId: "baby-smith" },
    to: "/baby/$publicId",
  });

  dismissOverlay({
    closeLink,
    history: {
      back,
      canGoBack: () => false,
      location: { state: { overlay: true } },
    },
    navigate,
  });

  expect(back).not.toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith(closeLink);
});

test("useOverlayNav owns enter/exit state and dismisses after animation", async () => {
  const frames: Array<FrameRequestCallback> = [];
  const requestFrame = vi
    .spyOn(globalThis, "requestAnimationFrame")
    .mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
  const cancelFrame = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  await using _animationFrame = makeResource({}, () => {
    requestFrame.mockRestore();
    cancelFrame.mockRestore();
  });

  const latest: BabyPostOverlayNavRef = { current: null };
  function Harness() {
    latest.current = useBabyPostOverlayNav("baby-smith");
    return null;
  }

  const history = createMemoryHistory({ initialEntries: ["/"] });
  history.push("/post", { overlay: true });
  const back = vi.spyOn(history, "back");
  const rootRoute = createRootRoute({
    component: Harness,
  });
  const router = createRouter({
    defaultPendingMinMs: 0,
    history,
    routeTree: rootRoute,
  });
  await router.load();
  await using _view = renderResource(<RouterProvider router={router} />);

  expect(latest.current?.open).toBe(false);
  act(() => {
    frames[0]?.(0);
  });
  expect(latest.current?.open).toBe(true);
  act(() => {
    latest.current?.close();
  });
  expect(latest.current?.open).toBe(false);
  expect(back).not.toHaveBeenCalled();

  const overlay = latest.current;
  if (!overlay) {
    throw new Error("expected overlay nav");
  }
  act(() => {
    overlay.onOpenChangeComplete(false);
  });
  expect(back).toHaveBeenCalledOnce();
});
