import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { babySeoHead, babyStatusLabel, homepageOgImagePath, robotsNoIndexMeta } from "@/lib/seo";
import { CANONICAL_ORIGIN, absoluteUrl, canonicalUrl } from "@/lib/site-url";

function useFakeTimersResource(now: Date) {
  vi.useFakeTimers({ now });
  return makeResource({}, () => {
    vi.useRealTimers();
  });
}

test("canonical URLs always point at production", () => {
  expect(canonicalUrl("/")).toBe(`${CANONICAL_ORIGIN}/`);
  expect(canonicalUrl("/baby/juniper-hale")).toBe(`${CANONICAL_ORIGIN}/baby/juniper-hale`);
});

test("absolute asset URLs accept an explicit origin", () => {
  expect(absoluteUrl(homepageOgImagePath(), "http://localhost:3000")).toBe(
    "http://localhost:3000/og",
  );
  expect(absoluteUrl("/og/baby/juniper-hale", "http://localhost:3000")).toBe(
    "http://localhost:3000/og/baby/juniper-hale",
  );
});

test("baby SEO head includes countdown title, description, and dynamic OG image", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  const seo = babySeoHead({
    name: "Juniper",
    dueDate: "2026-09-01",
    publicId: "juniper-hale",
    theme: "sunny-days",
    locale: "en-GB",
    babyBorn: null,
    wentToHospital: null,
    laborStarted: null,
  });

  expect(seo.title).toContain("21 days until due date");
  expect(seo.title).toContain("Juniper");
  expect(seo.description).toContain("Juniper");
  expect(seo.canonical).toBe(`${CANONICAL_ORIGIN}/baby/juniper-hale`);
  expect(seo.imageUrl).toContain("/og/baby/juniper-hale");
});

test("baby SEO description changes when the baby is born", () => {
  const seo = babySeoHead({
    name: "Milo",
    dueDate: "2026-08-01",
    publicId: "baby-born",
    theme: null,
    locale: "en-GB",
    babyBorn: "2026-08-10T10:00:00.000Z",
    wentToHospital: "2026-08-10T06:00:00.000Z",
    laborStarted: "2026-08-10T02:00:00.000Z",
  });

  expect(seo.description).toContain("arrived");
  expect(babyStatusLabel({ status: { type: "born", date: "2026-08-10" }, locale: "en-GB" })).toBe(
    "Yes! Baby is out",
  );
});

test("baby SEO descriptions cover labour and hospital stages", () => {
  const inLabor = babySeoHead({
    name: "Frankie",
    dueDate: "2026-08-20",
    publicId: "baby-in-labor",
    theme: null,
    locale: "en-GB",
    babyBorn: null,
    wentToHospital: null,
    laborStarted: "2026-08-14T01:00:00.000Z",
  });
  const atHospital = babySeoHead({
    name: "Rowan",
    dueDate: "2026-08-20",
    publicId: "baby-at-hospital",
    theme: null,
    locale: "en-GB",
    babyBorn: null,
    wentToHospital: "2026-08-14T02:00:00.000Z",
    laborStarted: "2026-08-14T01:00:00.000Z",
  });

  expect(inLabor.description).toContain("labour");
  expect(atHospital.description).toContain("hospital");
  expect(
    babyStatusLabel({
      status: { type: "labor_started", date: "2026-08-14T01:00:00.000Z" },
      locale: "en-GB",
    }),
  ).toBe("Labour started");
});

test("overdue baby titles use the overdue copy", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-20T12:00:00.000Z"));

  const seo = babySeoHead({
    name: "Avery",
    dueDate: "2026-08-11",
    publicId: "baby-waiting",
    theme: null,
    locale: "en-GB",
    babyBorn: null,
    wentToHospital: null,
    laborStarted: null,
  });

  expect(seo.title).toContain("overdue");
  expect(robotsNoIndexMeta()[0]?.content).toContain("noindex");
});
