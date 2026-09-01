import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import {
  babySeoHead,
  babyStatusDetail,
  babyStatusLabel,
  homepageOgImagePath,
  openGraphImageMeta,
  robotsNoIndexMeta,
} from "@/lib/seo";
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
    babyBorn: null,
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact",
    laborStarted: null,
    locale: "en-GB",
    name: "Juniper",
    publicId: "juniper-hale",
    theme: "sunny-days",
    wentToHospital: null,
  });

  expect(seo.title).toContain("21 days until due date");
  expect(seo.title).toContain("Juniper");
  expect(seo.description).toContain("Juniper");
  expect(seo.canonical).toBe(`${CANONICAL_ORIGIN}/baby/juniper-hale`);
  expect(seo.imageUrl).toContain("/og/baby/juniper-hale");
  expect(seo.indexable).toBe(true);
});

test("baby OG image URL version changes with rendered baby data", () => {
  const baby = {
    babyBorn: null,
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact" as const,
    laborStarted: null,
    locale: "en-GB" as const,
    name: "Avery",
    photoId: null,
    publicId: "baby-waiting",
    theme: null,
    wentToHospital: null,
  };
  const mangoUrl = new URL(babySeoHead(baby).imageUrl);
  const babyBlueUrl = new URL(babySeoHead({ ...baby, theme: "baby-blue" }).imageUrl);
  const photoUrl = new URL(babySeoHead({ ...baby, photoId: "storage-photo-id" }).imageUrl);

  expect(mangoUrl.pathname).toBe("/og/baby/baby-waiting");
  expect(mangoUrl.searchParams.get("v")).toBeTruthy();
  expect(babyBlueUrl.searchParams.get("v")).not.toBe(mangoUrl.searchParams.get("v"));
  expect(photoUrl.searchParams.get("v")).not.toBe(mangoUrl.searchParams.get("v"));
  expect(babySeoHead(baby).imageUrl).toBe(mangoUrl.toString());
});

test("custom due date text replaces countdown metadata", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));
  const baby = {
    babyBorn: null,
    dueDateDisplayMode: "message" as const,
    laborStarted: null,
    locale: "en-GB" as const,
    name: "Juniper",
    publicDueDateText: "Any day now",
    publicId: "juniper-hale",
    theme: "sunny-days",
    wentToHospital: null,
  };

  const seo = babySeoHead(baby);
  expect(seo.title).toContain("Is Juniper out yet?");
  expect(seo.title).not.toContain("until due date");
  expect(babyStatusDetail({ baby, status: { type: "not_yet" } })).toBe("Any day now");

  const exactModeSeo = babySeoHead({
    babyBorn: baby.babyBorn,
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact",
    laborStarted: baby.laborStarted,
    locale: baby.locale,
    name: baby.name,
    publicId: baby.publicId,
    theme: baby.theme,
    wentToHospital: baby.wentToHospital,
  });
  expect(exactModeSeo.title).toContain("21 days until due date");
});

test("baby SEO description changes when the baby is born", () => {
  const seo = babySeoHead({
    babyBorn: "2026-08-10T10:00:00.000Z",
    dueDate: "2026-08-01",
    dueDateDisplayMode: "exact",
    laborStarted: "2026-08-10T02:00:00.000Z",
    locale: "en-GB",
    name: "Milo",
    publicId: "baby-born",
    theme: null,
    wentToHospital: "2026-08-10T06:00:00.000Z",
  });

  expect(seo.description).toContain("arrived");
  expect(seo.indexable).toBe(false);
  expect(babyStatusLabel({ locale: "en-GB", status: { date: "2026-08-10", type: "born" } })).toBe(
    "Yes! Baby is out",
  );
});

test("baby SEO descriptions cover labour and hospital stages", () => {
  const inLabor = babySeoHead({
    babyBorn: null,
    dueDate: "2026-08-20",
    dueDateDisplayMode: "exact",
    laborStarted: "2026-08-14T01:00:00.000Z",
    locale: "en-GB",
    name: "Frankie",
    publicId: "baby-in-labor",
    theme: null,
    wentToHospital: null,
  });
  const atHospital = babySeoHead({
    babyBorn: null,
    dueDate: "2026-08-20",
    dueDateDisplayMode: "exact",
    laborStarted: "2026-08-14T01:00:00.000Z",
    locale: "en-GB",
    name: "Rowan",
    publicId: "baby-at-hospital",
    theme: null,
    wentToHospital: "2026-08-14T02:00:00.000Z",
  });

  expect(inLabor.description).toContain("labour");
  expect(atHospital.description).toContain("hospital");
  expect(
    babyStatusLabel({
      locale: "en-GB",
      status: { date: "2026-08-14T01:00:00.000Z", type: "labor_started" },
    }),
  ).toBe("Labour started");
});

test("hidden milestone data does not appear in public SEO copy", () => {
  const seo = babySeoHead({
    babyBorn: null,
    dueDate: "2026-08-20",
    dueDateDisplayMode: "exact",
    laborStarted: "2026-08-14T01:00:00.000Z",
    locale: "en-GB",
    milestoneVisibility: { showHospital: false, showLabor: false },
    name: "River",
    publicId: "river",
    theme: null,
    wentToHospital: "2026-08-14T02:00:00.000Z",
  });

  expect(seo.description).not.toContain("labour");
  expect(seo.description).not.toContain("hospital");
  expect(seo.description).toContain("River");
});

test("overdue baby titles use the overdue copy", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-20T12:00:00.000Z"));

  const seo = babySeoHead({
    babyBorn: null,
    dueDate: "2026-08-11",
    dueDateDisplayMode: "exact",
    laborStarted: null,
    locale: "en-GB",
    name: "Avery",
    publicId: "baby-waiting",
    theme: null,
    wentToHospital: null,
  });

  expect(seo.title).toContain("overdue");
  expect(robotsNoIndexMeta()[0]?.content).toContain("noindex");
});

test("baby titles use singular day copy for one-day overdue and one day until due", async () => {
  await using _untilTimers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));
  const untilDue = babySeoHead({
    babyBorn: null,
    dueDate: "2026-08-12",
    dueDateDisplayMode: "exact",
    laborStarted: null,
    locale: "en-GB",
    name: "Sage",
    publicId: "baby-waiting",
    theme: null,
    wentToHospital: null,
  });
  expect(untilDue.title).toContain("1 day until due date");

  await using _overdueTimers = useFakeTimersResource(new Date("2026-08-12T12:00:00.000Z"));
  const overdue = babySeoHead({
    babyBorn: null,
    dueDate: "2026-08-11",
    dueDateDisplayMode: "exact",
    laborStarted: null,
    locale: "en-GB",
    name: "Sage",
    publicId: "baby-waiting",
    theme: null,
    wentToHospital: null,
  });
  expect(overdue.title).toContain("1 day overdue");
});

test("born babies keep the base title without a due-date countdown", async () => {
  await using _timers = useFakeTimersResource(new Date("2026-08-20T12:00:00.000Z"));
  const seo = babySeoHead({
    babyBorn: "2026-08-10T10:00:00.000Z",
    dueDate: "2026-08-01",
    dueDateDisplayMode: "exact",
    laborStarted: "2026-08-10T02:00:00.000Z",
    locale: "en-GB",
    name: "Milo",
    publicId: "baby-born",
    theme: null,
    wentToHospital: "2026-08-10T06:00:00.000Z",
  });
  expect(seo.title).toContain("Is Milo out yet?");
  expect(seo.title).not.toContain("overdue");
  expect(seo.title).not.toContain("until due date");
});

test("baby status labels cover hospital and waiting states", () => {
  expect(
    babyStatusLabel({
      locale: "en-GB",
      status: { date: "2026-08-14T02:00:00.000Z", type: "gone_to_hospital" },
    }),
  ).toBe("Gone to hospital");
  expect(babyStatusLabel({ locale: "en-GB", status: { type: "not_yet" } })).toBe("Not yet");
});

test("baby status detail covers born, in-progress, overdue, and due-date copy", async () => {
  expect(
    babyStatusDetail({
      baby: {
        babyBorn: "2026-08-10T10:00:00.000Z",
        dueDate: "2026-08-01",
        dueDateDisplayMode: "exact",
        locale: "en-GB",
      },
      status: { date: "2026-08-10", type: "born" },
    }),
  ).toBe("Yes! Baby is out");
  expect(
    babyStatusDetail({
      baby: {
        babyBorn: null,
        dueDate: "2026-08-20",
        dueDateDisplayMode: "exact",
        locale: "en-GB",
      },
      status: { date: "2026-08-14T01:00:00.000Z", type: "labor_started" },
    }),
  ).toBe("Labour started");
  expect(
    babyStatusDetail({
      baby: {
        babyBorn: null,
        dueDate: "2026-08-20",
        dueDateDisplayMode: "exact",
        locale: "en-GB",
      },
      status: { date: "2026-08-14T02:00:00.000Z", type: "gone_to_hospital" },
    }),
  ).toBe("Gone to hospital");

  await using _untilTimers = useFakeTimersResource(new Date("2026-08-11T12:00:00.000Z"));
  expect(
    babyStatusDetail({
      baby: {
        babyBorn: null,
        dueDate: "2026-08-12",
        dueDateDisplayMode: "exact",
        locale: "en-GB",
      },
      status: { type: "not_yet" },
    }),
  ).toBe("1 day until due date");
  expect(
    babyStatusDetail({
      baby: {
        babyBorn: null,
        dueDate: "2026-09-01",
        dueDateDisplayMode: "exact",
        locale: "en-GB",
      },
      status: { type: "not_yet" },
    }),
  ).toBe("21 days until due date");

  await using _overdueTimers = useFakeTimersResource(new Date("2026-08-20T12:00:00.000Z"));
  expect(
    babyStatusDetail({
      baby: {
        babyBorn: null,
        dueDate: "2026-08-19",
        dueDateDisplayMode: "exact",
        locale: "en-GB",
      },
      status: { type: "not_yet" },
    }),
  ).toBe("1 day overdue");
  expect(
    babyStatusDetail({
      baby: {
        babyBorn: null,
        dueDate: "2026-08-11",
        dueDateDisplayMode: "exact",
        locale: "en-GB",
      },
      status: { type: "not_yet" },
    }),
  ).toBe("9 days overdue");
});

test("Open Graph image meta includes dimensions and a large Twitter card", () => {
  const tags = openGraphImageMeta({
    alt: "Is Baby Out Yet?",
    imageUrl: "https://isbabyoutyet.com/og",
  });
  expect(tags).toEqual(
    expect.arrayContaining([
      { content: "https://isbabyoutyet.com/og", property: "og:image" },
      { content: "1200", property: "og:image:width" },
      { content: "630", property: "og:image:height" },
      { content: "summary_large_image", name: "twitter:card" },
    ]),
  );
});
