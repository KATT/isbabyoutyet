import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { isValidTimeZone, TIME_ZONE_HINT_HEADER } from "@workspace/convex/src/timeZone";
import { parseVisitorIdHint, VISITOR_ID_HINT_HEADER } from "@workspace/convex/src/visitorId";
import { peekVisitorId } from "@/lib/use-visitor-id";

function browserTimeZone() {
  try {
    const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone && isValidTimeZone(timeZone) ? timeZone : null;
  } catch {
    return null;
  }
}

export function getBrowserAuthHeaders() {
  if (globalThis.window === undefined) {
    return {};
  }
  const timeZone = browserTimeZone();
  const visitorId = parseVisitorIdHint(peekVisitorId());
  if (timeZone && visitorId) {
    return {
      [TIME_ZONE_HINT_HEADER]: timeZone,
      [VISITOR_ID_HINT_HEADER]: visitorId,
    };
  }
  if (timeZone) {
    return { [TIME_ZONE_HINT_HEADER]: timeZone };
  }
  if (visitorId) {
    return { [VISITOR_ID_HINT_HEADER]: visitorId };
  }
  return {};
}

export type BrowserAuthHeaders = ReturnType<typeof getBrowserAuthHeaders>;

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SITE_URL,
  plugins: [convexClient()],
});
