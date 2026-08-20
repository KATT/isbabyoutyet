import { expect, test, vi } from "vitest";
import {
  babyOverlayHistoryState,
  babyOverlayOpenLink,
  dismissBabyOverlay,
} from "@/lib/overlay-route";

test("babyOverlayOpenLink pushes with overlay state and keeps scroll", () => {
  expect(
    babyOverlayOpenLink({
      to: "/baby/$publicId/post",
      publicId: "baby-smith",
    }),
  ).toEqual({
    to: "/baby/$publicId/post",
    params: { publicId: "baby-smith" },
    resetScroll: false,
    state: babyOverlayHistoryState,
  });
});

test("dismissBabyOverlay prefers history.back when the overlay was pushed", () => {
  const back = vi.fn<() => void>();
  const navigate = vi.fn<(opts: unknown) => void>();

  dismissBabyOverlay({
    router: {
      history: {
        location: { state: { babyOverlay: true } },
        canGoBack: () => true,
        back,
      },
      navigate,
    },
    publicId: "baby-smith",
  });

  expect(back).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
});

test("dismissBabyOverlay replaces to the baby page without overlay history", () => {
  const back = vi.fn<() => void>();
  const navigate = vi.fn<(opts: unknown) => void>();

  dismissBabyOverlay({
    router: {
      history: {
        location: { state: { babyOverlay: undefined } },
        canGoBack: () => true,
        back,
      },
      navigate,
    },
    publicId: "baby-smith",
  });

  expect(back).not.toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith({
    to: "/baby/$publicId",
    params: { publicId: "baby-smith" },
    replace: true,
    resetScroll: false,
  });
});

test("dismissBabyOverlay replaces when history cannot go back", () => {
  const back = vi.fn<() => void>();
  const navigate = vi.fn<(opts: unknown) => void>();

  dismissBabyOverlay({
    router: {
      history: {
        location: { state: { babyOverlay: true } },
        canGoBack: () => false,
        back,
      },
      navigate,
    },
    publicId: "baby-smith",
  });

  expect(back).not.toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith({
    to: "/baby/$publicId",
    params: { publicId: "baby-smith" },
    replace: true,
    resetScroll: false,
  });
});
