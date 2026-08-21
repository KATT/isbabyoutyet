import { useRouter } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";

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
  history: {
    location: { state: { overlay: true | undefined } };
    canGoBack: () => boolean;
    back: () => void;
  };
  navigate: (closeLink: LinkProps) => unknown;
  closeLink: LinkProps;
}) {
  if (isOverlayHistoryState(opts.history.location.state) && opts.history.canGoBack()) {
    opts.history.back();
    return;
  }
  void opts.navigate(opts.closeLink);
}

type UseOverlayNavOptions = {
  open: OverlayOpenInput;
  close: OverlayCloseInput;
};

type OverlayNav = {
  /** Spread onto `<Link>` / pass to `navigate` to open the overlay (push). */
  openLink: LinkProps;
  /** Spread onto `<Link>` / pass to `navigate` for replace-close fallback. */
  closeLink: LinkProps;
  /**
   * Close the overlay: `history.back()` when this entry was push-opened and the
   * router can go back; otherwise navigate with {@link closeLink}.
   */
  dismiss: () => void;
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
export function useOverlayNav(opts: UseOverlayNavOptions): OverlayNav {
  const router = useRouter();
  const openLink = openOverlayLink(opts.open);
  const closeLink = closeOverlayLink(opts.close);

  return {
    openLink,
    closeLink,
    dismiss: () => {
      dismissOverlay({
        history: router.history,
        navigate: (link) => {
          void router.navigate(link);
        },
        closeLink,
      });
    },
  };
}
