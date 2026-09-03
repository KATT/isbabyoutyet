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
  const headers: Record<string, string> = {};
  if (globalThis.window === undefined) {
    return headers;
  }
  const timeZone = browserTimeZone();
  const visitorId = parseVisitorIdHint(peekVisitorId());
  if (timeZone) {
    headers[TIME_ZONE_HINT_HEADER] = timeZone;
  }
  if (visitorId) {
    headers[VISITOR_ID_HINT_HEADER] = visitorId;
  }
  return headers;
}

export type BrowserAuthHeaders = ReturnType<typeof getBrowserAuthHeaders>;

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SITE_URL,
  plugins: [convexClient()],
});
