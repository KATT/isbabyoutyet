import type { ParsedLocation } from "@tanstack/react-router";

const ADMIN_PATH = "/dashboard/admin";

/**
 * Scroll cache key for TanStack Router. Ephemeral UI search params (e.g.
 * `settings`) are excluded so opening/closing modals does not reset scroll.
 * Admin tabs keep separate keys so each tab remembers its own position.
 */
export function getScrollRestorationKey(location: ParsedLocation) {
  if (location.pathname === ADMIN_PATH) {
    const params = new URLSearchParams(location.searchStr);
    const tab = params.get("tab") ?? "babies";
    return `${ADMIN_PATH}?tab=${tab}`;
  }

  return location.pathname;
}

/** Pass to Link or navigate when only search params change on the same page. */
export const preserveScroll = { resetScroll: false } as const;
