import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { isValidTimeZone, TIME_ZONE_HINT_HEADER } from "@workspace/convex/src/timeZone";

export function getBrowserAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone && isValidTimeZone(timeZone) ? { [TIME_ZONE_HINT_HEADER]: timeZone } : {};
  } catch {
    return {};
  }
}

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SITE_URL,
  plugins: [convexClient()],
});
