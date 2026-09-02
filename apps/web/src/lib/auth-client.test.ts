import { expect, test } from "vitest";
import { TIME_ZONE_HINT_HEADER } from "@workspace/convex/src/timeZone";
import { VISITOR_ID_HINT_HEADER } from "@workspace/convex/src/visitorId";
import { getBrowserAuthHeaders } from "@/lib/auth-client";

test("getBrowserAuthHeaders includes the stored visitor id when present", () => {
  localStorage.setItem("encouragement-visitor-id", "visitor-from-guestbook");
  try {
    const headers = getBrowserAuthHeaders();
    expect(VISITOR_ID_HINT_HEADER in headers).toBe(true);
    if (VISITOR_ID_HINT_HEADER in headers) {
      expect(headers[VISITOR_ID_HINT_HEADER]).toBe("visitor-from-guestbook");
    }
    expect(TIME_ZONE_HINT_HEADER in headers).toBe(true);
  } finally {
    localStorage.removeItem("encouragement-visitor-id");
  }
});

test("getBrowserAuthHeaders omits visitor id when none is stored", () => {
  localStorage.removeItem("encouragement-visitor-id");
  const headers = getBrowserAuthHeaders();
  expect(VISITOR_ID_HINT_HEADER in headers).toBe(false);
});
