import { useRouter } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";

declare module "@tanstack/history" {
  interface HistoryState {
    /** Set when a baby overlay was opened via push from in-app navigation. */
    babyOverlay: true | undefined;
  }
}

/** History state marker for push-opened baby overlays (settings / post). */
export const babyOverlayHistoryState = { babyOverlay: true as const };

type BabyOverlayPath = "/baby/$publicId/settings" | "/baby/$publicId/post";

/**
 * Link/navigate options to *open* a baby overlay: push a history entry and
 * mark it so dismiss can prefer `history.back()`.
 */
export function babyOverlayOpenLink(opts: {
  to: BabyOverlayPath;
  publicId: string;
}): LinkProps {
  return {
    to: opts.to,
    params: { publicId: opts.publicId },
    resetScroll: false,
    state: babyOverlayHistoryState,
  };
}

/**
 * Close a baby overlay the best-in-class way:
 * - If this entry was push-opened (`babyOverlay` state) and TanStack can go
 *   back (`router.history.canGoBack()`), use `history.back()` so Back/swipe
 *   matches the dialog dismiss.
 * - Otherwise replace to the baby page (direct load, shared link, or no prior
 *   in-app entry).
 */
export function dismissBabyOverlay(opts: {
  router: {
    history: {
      location: { state: { babyOverlay: true | undefined } };
      canGoBack: () => boolean;
      back: () => void;
    };
    navigate: (opts: {
      to: "/baby/$publicId";
      params: { publicId: string };
      replace: boolean;
      resetScroll: boolean;
    }) => unknown;
  };
  publicId: string;
}) {
  const history = opts.router.history;
  if (history.location.state.babyOverlay === true && history.canGoBack()) {
    history.back();
    return;
  }
  void opts.router.navigate({
    to: "/baby/$publicId",
    params: { publicId: opts.publicId },
    replace: true,
    resetScroll: false,
  });
}

/** Hook wrapper around {@link dismissBabyOverlay} for overlay route components. */
export function useDismissBabyOverlay(publicId: string) {
  const router = useRouter();
  return () => {
    dismissBabyOverlay({ router, publicId });
  };
}
