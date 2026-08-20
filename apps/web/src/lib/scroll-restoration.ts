import type { ParsedLocation } from "@tanstack/react-router";

const ADMIN_PATH = "/dashboard/admin";
const SETTINGS_SUFFIX = "/settings";

/**
 * Scroll cache key for TanStack Router. The `/settings` child route is treated
 * as ephemeral overlay state on the parent page. Admin tabs keep separate keys.
 */
export function getScrollRestorationKey(location: ParsedLocation) {
  let pathname = location.pathname;
  if (pathname.endsWith(SETTINGS_SUFFIX)) {
    pathname = pathname.slice(0, -SETTINGS_SUFFIX.length) || "/";
  }

  if (pathname === ADMIN_PATH) {
    const params = new URLSearchParams(location.searchStr);
    const tab = params.get("tab") ?? "babies";
    return `${ADMIN_PATH}?tab=${tab}`;
  }

  return pathname;
}

/** Pass to Link or navigate when only overlay routes or search params change. */
export const preserveScroll = { resetScroll: false } as const;
