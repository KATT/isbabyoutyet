/**
 * Shared demo login + seeded babies used by the Convex seeder and the web auth forms.
 *
 * DEMO_USER / DEMO_BABIES: local development and Vercel preview only — never production.
 * HOMEPAGE_DEMO_BABY: seeded in every environment, including production.
 *
 * Keep AGENTS.md in sync when changing publicIds.
 */
export const DEMO_USER = {
  email: "test@example.com",
  password: "password",
  name: "Test User",
} as const;

export const DEMO_BABIES = [
  {
    name: "Baby Waiting",
    publicId: "baby-waiting",
    state: "not_yet",
    label: "Not yet",
  },
  {
    name: "Baby In Labor",
    publicId: "baby-in-labor",
    state: "labor_started",
    label: "Labour started",
  },
  {
    name: "Baby At Hospital",
    publicId: "baby-at-hospital",
    state: "gone_to_hospital",
    label: "Gone to hospital",
  },
  {
    name: "Baby Born",
    publicId: "baby-born",
    state: "born",
    label: "Born",
  },
] as const;

/**
 * Public live-demo baby linked from the homepage. Owned by a sentinel userId
 * so it never appears on a real dashboard. Re-seeded on every deploy (dates
 * shifted to "now", visitor comments wiped, fixture feed restored).
 */
export const HOMEPAGE_DEMO_BABY = {
  name: "Juniper Hale",
  publicId: "juniper",
  ownerUserId: "homepage-demo",
  theme: "sunny-days",
} as const;
