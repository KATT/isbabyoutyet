import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { isValidTimeZone, TIME_ZONE_HINT_HEADER } from "@workspace/convex/src/timeZone";
import { parseVisitorIdHint, VISITOR_ID_HINT_HEADER } from "@workspace/convex/src/visitorId";
import { peekVisitorId } from "@/lib/use-visitor-id";

export function getBrowserAuthHeaders(): Record<string, string> {
  if (globalThis.window === undefined) {
    return {};
  }
  const headers: Record<string, string> = {};
  try {
    const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone && isValidTimeZone(timeZone)) {
      headers[TIME_ZONE_HINT_HEADER] = timeZone;
    }
  } catch {
    // Intl can throw in exotic environments; sign-in still works without the hint.
  }
  const visitorId = parseVisitorIdHint(peekVisitorId());
  if (visitorId) {
    headers[VISITOR_ID_HINT_HEADER] = visitorId;
  }
  return headers;
}

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SITE_URL,
  plugins: [convexClient()],
});
