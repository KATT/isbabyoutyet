import { useRouter } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/** History state marker for push-opened overlays. */
const overlayHistoryState = { overlay: true as const };

function isOverlayHistoryState(state: { overlay: true | undefined }) {
  return state.overlay === true;
}

type OverlayOpenInput = Omit<LinkProps, "resetScroll" | "state" | "replace" | "preload">;
type OverlayCloseInput = Omit<LinkProps, "resetScroll" | "replace">;

/**
 * Link/navigate options to *open* an overlay: push a history entry, preload
 * while its real Link is visible, keep scroll, and mark `state.overlay` so
 * dismiss can prefer `history.back()`.
 *
 * Pass to `<Link {...opts} />` or `navigate(opts)`.
 *
 * @public
 */
export function openOverlayLink(options: OverlayOpenInput): LinkProps {
  return {
    ...options,
    preload: "viewport",
    resetScroll: false,
    state: overlayHistoryState,
  };
}

/**
 * Link/navigate options to *close* an overlay via replace (the fallback when
 * there is no push-opened history entry to go back to).
 *
 * Pass to `<Link {...opts} />` or `navigate(opts)`. Prefer
 * {@link useOverlayNav}'s `dismiss` when the overlay may have been push-opened.
 *
 * @public
 */
export function closeOverlayLink(options: OverlayCloseInput): LinkProps {
  return {
    ...options,
    replace: true,
    resetScroll: false,
  };
}

/**
 * Close an overlay the best-in-class way:
 * - If this entry was push-opened (`overlay` state) and TanStack can go back,
 *   use `history.back()` so Back/swipe matches dialog dismiss.
 * - Otherwise navigate with the provided close link (replace fallback).
 *
 * @public
 */
export function dismissOverlay(opts: {
  closeLink: LinkProps;
  history: {
    back: () => void;
    canGoBack: () => boolean;
    location: { state: { overlay: true | undefined } };
  };
  navigate: (closeLink: LinkProps) => void;
}) {
  if (isOverlayHistoryState(opts.history.location.state) && opts.history.canGoBack()) {
    console.log("dismissOverlay: history.back");
    opts.history.back();
    return;
  }
  console.log("dismissOverlay: navigate", opts.closeLink);
  void opts.navigate(opts.closeLink);
}

type UseOverlayNavOptions = {
  close: OverlayCloseInput;
  open: OverlayOpenInput;
};

type OverlayNav = {
  /** Start the overlay's exit animation. */
  close: () => void;
  /** Spread onto `<Link>` / pass to `navigate` for replace-close fallback. */
  closeLink: LinkProps;
  /**
   * Close the overlay: `history.back()` when this entry was push-opened and the
   * router can go back; otherwise navigate with {@link closeLink}.
   */
  dismiss: () => void;
  /** Pass to the overlay primitive's `onOpenChange`. */
  onOpenChange: (open: boolean) => void;
  /** Pass to `onOpenChangeComplete` so navigation waits for the exit animation. */
  onOpenChangeComplete: (open: boolean) => void;
  /** Whether the route-backed overlay should currently be visible. */
  open: boolean;
  /** Spread onto `<Link>` / pass to `navigate` to open the overlay (push). */
  openLink: LinkProps;
};

/**
 * Open/close helpers for a route-backed overlay (settings, post update, …).
 *
 * @example
 * ```tsx
 * const post = useOverlayNav({
 *   open: { to: "/baby/$publicId/post", params: { publicId } },
 *   close: { to: "/baby/$publicId", params: { publicId } },
 * });
 *
 * <Link {...post.openLink} />
 * <Button onClick={post.dismiss} />
 * // or declarative close: <Link {...post.closeLink} />
 * ```
 */
export type OverlayControl = Pick<
  OverlayNav,
  "open" | "close" | "onOpenChange" | "onOpenChangeComplete"
>;

function useOverlayNav(opts: UseOverlayNavOptions): OverlayNav {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Defer open until after the first paint so Base UI sees closed→open and
    // applies `data-starting-style` enter transitions. Must stay async (rAF),
    // not useLayoutEffect — the browser needs one closed frame first.
    const frame = requestAnimationFrame(() => {
      setOpen(true);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);
  const openLink = openOverlayLink(opts.open);
  const closeLink = closeOverlayLink(opts.close);
  const dismiss = () => {
    dismissOverlay({
      closeLink,
      history: router.history,
      navigate: (link) => {
        void router.navigate(link);
      },
    });
  };

  return {
    close: () => {
      setOpen(false);
    },
    closeLink,
    dismiss,
    onOpenChange: (nextOpen) => {
      if (!nextOpen) {
        setOpen(false);
      }
    },
    onOpenChangeComplete: (nextOpen) => {
      console.log("onOpenChangeComplete", nextOpen);
      if (!nextOpen) {
        dismiss();
      }
    },
    open,
    openLink,
  };
}

export function useDashboardSettingsOverlayNav() {
  return useOverlayNav({
    close: { to: "/dashboard" },
    open: { to: "/dashboard/settings" },
  });
}

export function useBabySettingsOverlayNav(publicId: string) {
  return useOverlayNav({
    close: { params: { publicId }, to: "/baby/$publicId" },
    open: { params: { publicId }, to: "/baby/$publicId/settings" },
  });
}

export function useBabyPostOverlayNav(publicId: string) {
  return useOverlayNav({
    close: { params: { publicId }, to: "/baby/$publicId" },
    open: { params: { publicId }, to: "/baby/$publicId/post" },
  });
}

export function useBabyShareOverlayNav(publicId: string) {
  return useOverlayNav({
    close: { params: { publicId }, to: "/baby/$publicId" },
    open: { params: { publicId }, to: "/baby/$publicId/share" },
  });
}

export function useBabyLoginOverlayNav(publicId: string) {
  return useOverlayNav({
    close: { params: { publicId }, to: "/baby/$publicId" },
    open: { params: { publicId }, to: "/baby/$publicId/login" },
  });
}

export function useBabyPhotoOverlayNav(publicId: string) {
  return useOverlayNav({
    close: { params: { publicId }, to: "/baby/$publicId" },
    open: { params: { publicId }, to: "/baby/$publicId/photo" },
  });
}

export function useBabyUpdatePhotoOverlayNav(opts: { publicId: string; updateId: string }) {
  return useOverlayNav({
    close: { params: { publicId: opts.publicId }, to: "/baby/$publicId" },
    open: {
      params: { publicId: opts.publicId, updateId: opts.updateId },
      to: "/baby/$publicId/updates/$updateId/photo",
    },
  });
}
