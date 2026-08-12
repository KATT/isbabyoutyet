/**
 * Shared demo login + seeded babies used by the Convex seeder and the web auth forms.
 * Available in local development and Vercel preview deployments — never production.
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
