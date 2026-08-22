import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import {
  closeOverlayLink,
  dismissOverlay,
  openOverlayLink,
  useBabyPostOverlayNav,
} from "@/lib/overlay-nav";

const router = vi.hoisted(() => ({
  history: {
    location: { state: { overlay: true as true | undefined } },
    canGoBack: () => true,
    back: vi.fn<() => void>(),
  },
  navigate: vi.fn<(opts: unknown) => Promise<void>>(async () => {}),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => router,
}));

test("openOverlayLink preloads through a real link and keeps overlay history", () => {
  expect(
    openOverlayLink({
      to: "/baby/$publicId/post",
      params: { publicId: "baby-smith" },
    }),
  ).toEqual({
    to: "/baby/$publicId/post",
    params: { publicId: "baby-smith" },
    preload: "viewport",
    resetScroll: false,
    state: { overlay: true },
  });
});

test("closeOverlayLink replaces to the close target without scroll reset", () => {
  expect(
    closeOverlayLink({
      to: "/baby/$publicId",
      params: { publicId: "baby-smith" },
    }),
  ).toEqual({
    to: "/baby/$publicId",
    params: { publicId: "baby-smith" },
    replace: true,
    resetScroll: false,
  });
});

test("dismissOverlay prefers history.back when the overlay was push-opened", () => {
  const back = vi.fn<() => void>();
  const navigate = vi.fn<(opts: unknown) => void>();
  const closeLink = closeOverlayLink({
    to: "/baby/$publicId",
    params: { publicId: "baby-smith" },
  });

  dismissOverlay({
    history: {
      location: { state: { overlay: true } },
      canGoBack: () => true,
      back,
    },
    navigate,
    closeLink,
  });

  expect(back).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
});

test("dismissOverlay navigates with closeLink without overlay history", () => {
  const back = vi.fn<() => void>();
  const navigate = vi.fn<(opts: unknown) => void>();
  const closeLink = closeOverlayLink({
    to: "/baby/$publicId",
    params: { publicId: "baby-smith" },
  });

  dismissOverlay({
    history: {
      location: { state: { overlay: undefined } },
      canGoBack: () => true,
      back,
    },
    navigate,
    closeLink,
  });

  expect(back).not.toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith(closeLink);
});

test("dismissOverlay navigates with closeLink when history cannot go back", () => {
  const back = vi.fn<() => void>();
  const navigate = vi.fn<(opts: unknown) => void>();
  const closeLink = closeOverlayLink({
    to: "/baby/$publicId",
    params: { publicId: "baby-smith" },
  });

  dismissOverlay({
    history: {
      location: { state: { overlay: true } },
      canGoBack: () => false,
      back,
    },
    navigate,
    closeLink,
  });

  expect(back).not.toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith(closeLink);
});

test("useOverlayNav owns enter/exit state and dismisses after animation", async () => {
  router.history.back.mockClear();
  const hook = renderHook(() => useBabyPostOverlayNav("baby-smith"));

  expect(hook.result.current.open).toBe(false);
  await vi.waitFor(() => {
    expect(hook.result.current.open).toBe(true);
  });
  act(() => {
    hook.result.current.close();
  });
  expect(hook.result.current.open).toBe(false);
  expect(router.history.back).not.toHaveBeenCalled();

  act(() => {
    hook.result.current.onOpenChangeComplete(false);
  });
  expect(router.history.back).toHaveBeenCalledOnce();
});
