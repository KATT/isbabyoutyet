import { useRouter } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";

/** History state marker for push-opened route modals. */
const routeModalHistoryState = { routeModal: true as const };

function isRouteModalHistoryState(state: { routeModal: true | undefined }) {
  return state.routeModal === true;
}

type RouteModalOpenInput = Omit<LinkProps, "resetScroll" | "state" | "replace">;
type RouteModalCloseInput = Omit<LinkProps, "resetScroll" | "replace">;

/**
 * Link/navigate options to *open* a route modal: push a history entry, keep
 * scroll, and mark `state.routeModal` so dismiss can prefer `history.back()`.
 *
 * Pass to `<Link {...opts} />` or `navigate(opts)`.
 *
 * @public
 */
export function routeModalOpenLink(options: RouteModalOpenInput): LinkProps {
  return {
    ...options,
    resetScroll: false,
    state: routeModalHistoryState,
  };
}

/**
 * Link/navigate options to *close* a route modal via replace (the fallback
 * when there is no push-opened history entry to go back to).
 *
 * Pass to `<Link {...opts} />` or `navigate(opts)`. Prefer
 * {@link useRouteModal}'s `dismiss` when the modal may have been push-opened.
 *
 * @public
 */
export function routeModalCloseLink(options: RouteModalCloseInput): LinkProps {
  return {
    ...options,
    replace: true,
    resetScroll: false,
  };
}

/**
 * Close a route modal the best-in-class way:
 * - If this entry was push-opened (`routeModal` state) and TanStack can go
 *   back, use `history.back()` so Back/swipe matches dialog dismiss.
 * - Otherwise navigate with the provided close link (replace fallback).
 *
 * @public
 */
export function dismissRouteModal(opts: {
  history: {
    location: { state: { routeModal: true | undefined } };
    canGoBack: () => boolean;
    back: () => void;
  };
  navigate: (closeLink: LinkProps) => unknown;
  closeLink: LinkProps;
}) {
  if (isRouteModalHistoryState(opts.history.location.state) && opts.history.canGoBack()) {
    opts.history.back();
    return;
  }
  void opts.navigate(opts.closeLink);
}

type UseRouteModalOptions = {
  open: RouteModalOpenInput;
  close: RouteModalCloseInput;
};

type RouteModal = {
  /** Spread onto `<Link>` / pass to `navigate` to open the modal (push). */
  openLink: LinkProps;
  /** Spread onto `<Link>` / pass to `navigate` for replace-close fallback. */
  closeLink: LinkProps;
  /**
   * Close the modal: `history.back()` when this entry was push-opened and the
   * router can go back; otherwise navigate with {@link closeLink}.
   */
  dismiss: () => void;
};

/**
 * Typed open/close helpers for a route-backed modal overlay.
 *
 * @example
 * ```tsx
 * const postModal = useRouteModal({
 *   open: { to: "/baby/$publicId/post", params: { publicId } },
 *   close: { to: "/baby/$publicId", params: { publicId } },
 * });
 *
 * <Link {...postModal.openLink} />
 * <Button onClick={postModal.dismiss} />
 * // or declarative close: <Link {...postModal.closeLink} />
 * ```
 */
export function useRouteModal(opts: UseRouteModalOptions): RouteModal {
  const router = useRouter();
  const openLink = routeModalOpenLink(opts.open);
  const closeLink = routeModalCloseLink(opts.close);

  return {
    openLink,
    closeLink,
    dismiss: () => {
      dismissRouteModal({
        history: router.history,
        navigate: (link) => {
          void router.navigate(link);
        },
        closeLink,
      });
    },
  };
}
