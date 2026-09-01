import { expect, test, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { DEFAULT_MILESTONE_VISIBILITY } from "@workspace/convex/src/types";
import { getBabySeo } from "@/lib/baby-seo";

type PublicBabyDoc = NonNullable<FunctionReturnType<typeof api.baby.getByPublicId>>;

function useFakeTimersResource(now: Date) {
  vi.useFakeTimers({ now });
  return makeResource({}, () => {
    vi.useRealTimers();
  });
}

const publicBabyBase = {
  // SAFETY: Seeded convex-test document id.
  _id: "baby-1" as Id<"baby">,
  _creationTime: 1,
  name: "Juniper Hale",
  theme: "baby-blue",
  locale: "en-GB" as const,
  resolvedLocale: "en-GB" as const,
  timeZone: "Europe/London",
  laborStarted: null,
  wentToHospital: null,
  babyBorn: null,
  milestoneVisibility: DEFAULT_MILESTONE_VISIBILITY,
  publicId: "juniper-hale-1",
  photoUrl: null,
  thumbnailUrl: null,
  blurDataUrl: null,
};

test("getBabySeo maps exact mode onto the canonical route slug", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));
  const doc = {
    ...publicBabyBase,
    dueDateDisplayMode: "exact" as const,
    dueDate: "2026-09-01",
  } satisfies PublicBabyDoc;

  const seo = getBabySeo(doc, "juniper-hale");

  expect(seo.title).toContain("21 days until due date");
  expect(seo.canonical).toBe("https://isbabyoutyet.com/baby/juniper-hale");
  expect(new URL(seo.imageUrl).pathname).toBe("/og/baby/juniper-hale");
});

test("getBabySeo coalesces omitted public due date text", () => {
  const doc = {
    ...publicBabyBase,
    dueDateDisplayMode: "message" as const,
    publicDueDateText: undefined,
  } satisfies PublicBabyDoc;

  const seo = getBabySeo(doc, "juniper-hale");

  expect(seo.title).toContain("Is Juniper Hale out yet?");
  expect(seo.title).not.toContain("until due date");
  expect(seo.canonical).toBe("https://isbabyoutyet.com/baby/juniper-hale");
});

test("getBabySeo keeps custom public due date text out of the title countdown", () => {
  const doc = {
    ...publicBabyBase,
    dueDateDisplayMode: "message" as const,
    publicDueDateText: "Any day now",
  } satisfies PublicBabyDoc;

  const seo = getBabySeo(doc, "juniper-hale");

  expect(seo.title).toContain("Is Juniper Hale out yet?");
  expect(seo.title).not.toContain("until due date");
  expect(seo.description).toContain("Juniper Hale");
});
