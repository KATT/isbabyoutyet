import type { RenderResult } from "@testing-library/react";
import { vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { BabyData } from "@workspace/convex/src/types";

export function useFakeTimersResource(now: Date) {
  vi.useFakeTimers({ now });
  return makeResource({}, () => {
    vi.useRealTimers();
  });
}

export function renderResource(view: RenderResult) {
  return makeResource(view, () => {
    view.unmount();
  });
}

export function makeBaby(overrides: Partial<BabyData>): BabyData {
  return {
    name: "Baby Smith",
    dueDate: "2026-09-01",
    theme: null,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    hospitalMessage: null,
    babyBornMessage: null,
    laborStartedMessage: null,
    encouragementsDisabled: false,
    photoId: null,
    thumbnailId: null,
    ...overrides,
  };
}
