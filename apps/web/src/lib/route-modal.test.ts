import { expect, test, vi } from "vitest";
import { dismissRouteModal, routeModalCloseLink, routeModalOpenLink } from "@/lib/route-modal";

test("routeModalOpenLink pushes with routeModal state and keeps scroll", () => {
  expect(
    routeModalOpenLink({
      to: "/baby/$publicId/post",
      params: { publicId: "baby-smith" },
    }),
  ).toEqual({
    to: "/baby/$publicId/post",
    params: { publicId: "baby-smith" },
    resetScroll: false,
    state: { routeModal: true },
  });
});

test("routeModalCloseLink replaces to the close target without scroll reset", () => {
  expect(
    routeModalCloseLink({
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

test("dismissRouteModal prefers history.back when the modal was push-opened", () => {
  const back = vi.fn<() => void>();
  const navigate = vi.fn<(opts: unknown) => void>();
  const closeLink = routeModalCloseLink({
    to: "/baby/$publicId",
    params: { publicId: "baby-smith" },
  });

  dismissRouteModal({
    history: {
      location: { state: { routeModal: true } },
      canGoBack: () => true,
      back,
    },
    navigate,
    closeLink,
  });

  expect(back).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
});

test("dismissRouteModal navigates with closeLink without routeModal history", () => {
  const back = vi.fn<() => void>();
  const navigate = vi.fn<(opts: unknown) => void>();
  const closeLink = routeModalCloseLink({
    to: "/baby/$publicId",
    params: { publicId: "baby-smith" },
  });

  dismissRouteModal({
    history: {
      location: { state: { routeModal: undefined } },
      canGoBack: () => true,
      back,
    },
    navigate,
    closeLink,
  });

  expect(back).not.toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith(closeLink);
});

test("dismissRouteModal navigates with closeLink when history cannot go back", () => {
  const back = vi.fn<() => void>();
  const navigate = vi.fn<(opts: unknown) => void>();
  const closeLink = routeModalCloseLink({
    to: "/baby/$publicId",
    params: { publicId: "baby-smith" },
  });

  dismissRouteModal({
    history: {
      location: { state: { routeModal: true } },
      canGoBack: () => false,
      back,
    },
    navigate,
    closeLink,
  });

  expect(back).not.toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith(closeLink);
});
