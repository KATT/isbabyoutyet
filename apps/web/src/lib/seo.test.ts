import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import {
  babyOgImagePath,
  babyPageDescription,
  babyPageTitle,
  babyStatusLabel,
  homepageOgImagePath,
} from "@/lib/seo";
import { CANONICAL_ORIGIN, absoluteUrl, canonicalUrl, getSiteOrigin } from "@/lib/site-url";

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

test("absolute asset URLs use the deployment origin when set", () => {
  expect(getSiteOrigin().length).toBeGreaterThan(0);
  expect(absoluteUrl(homepageOgImagePath(), "http://localhost:3000")).toBe(
    "http://localhost:3000/og.png",
  );
  expect(absoluteUrl(babyOgImagePath("juniper-hale"), "http://localhost:3000")).toBe(
    "http://localhost:3000/baby/juniper-hale/og.png",
  );
});

test("baby page titles include countdown before birth", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));

  const title = babyPageTitle({
    name: "Juniper",
    dueDate: "2026-09-01",
    publicId: "juniper-hale",
    theme: "sunny-days",
    locale: "en-GB",
    babyBorn: null,
    wentToHospital: null,
    laborStarted: null,
  });
  expect(title).toContain("21 days until due date");
  expect(title).toContain("Juniper");
});

test("baby page descriptions change with status", () => {
  const waiting = babyPageDescription({
    name: "Avery",
    dueDate: "2026-09-01",
    publicId: "baby-waiting",
    theme: null,
    locale: "en-GB",
    babyBorn: null,
    wentToHospital: null,
    laborStarted: null,
  });
  const born = babyPageDescription({
    name: "Milo",
    dueDate: "2026-08-01",
    publicId: "baby-born",
    theme: null,
    locale: "en-GB",
    babyBorn: "2026-08-10T10:00:00.000Z",
    wentToHospital: "2026-08-10T06:00:00.000Z",
    laborStarted: "2026-08-10T02:00:00.000Z",
  });

  expect(waiting).toContain("Avery");
  expect(born).toContain("arrived");
  expect(babyStatusLabel({ status: { type: "born", date: "2026-08-10" }, locale: "en-GB" })).toBe(
    "Yes! Baby is out",
  );
});
