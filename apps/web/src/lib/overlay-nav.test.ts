import { expect, test, vi } from "vitest";
import { closeOverlayLink, dismissOverlay, openOverlayLink } from "@/lib/overlay-nav";

test("openOverlayLink pushes with overlay state and keeps scroll", () => {
  expect(
    openOverlayLink({
      to: "/baby/$publicId/post",
      params: { publicId: "baby-smith" },
    }),
  ).toEqual({
    to: "/baby/$publicId/post",
    params: { publicId: "baby-smith" },
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
