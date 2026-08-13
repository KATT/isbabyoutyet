/**
 * Shared demo login + seeded babies used by the Convex seeder and the web auth forms.
 *
 * DEMO_USER / DEMO_BABIES: local development and Vercel preview only — never production.
 * HOMEPAGE_DEMO_BABIES: seeded in every environment, including production — one live
 * demo page per supported locale, sharing photos and timeline shape.
 *
 * Keep AGENTS.md in sync when changing publicIds.
 */
import type { SupportedLocale } from "./i18n";
import { SUPPORTED_LOCALES } from "./i18n";

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

export const HOMEPAGE_DEMO_OWNER_USER_ID = "homepage-demo";
export const HOMEPAGE_DEMO_THEME = "sunny-days";

/**
 * One public live-demo baby per locale. Same sentinel owner so they never
 * appear on a real dashboard. Re-seeded on every deploy.
 */
export const HOMEPAGE_DEMO_BABIES = {
  "en-GB": { locale: "en-GB", name: "Juniper Hale", publicId: "juniper-hale" },
  "en-US": { locale: "en-US", name: "Willow Brooks", publicId: "willow-brooks" },
  sv: { locale: "sv", name: "Ella Holm", publicId: "ella-holm" },
  es: { locale: "es", name: "Lucía Navarro", publicId: "lucia-navarro" },
  "pt-BR": { locale: "pt-BR", name: "Helena Costa", publicId: "helena-costa" },
} as const satisfies Record<
  SupportedLocale,
  { locale: SupportedLocale; name: string; publicId: string }
>;

/** Default / English homepage demo (British English). */
export const HOMEPAGE_DEMO_BABY = {
  ...HOMEPAGE_DEMO_BABIES["en-GB"],
  ownerUserId: HOMEPAGE_DEMO_OWNER_USER_ID,
  theme: HOMEPAGE_DEMO_THEME,
} as const;

export function homepageDemoBabyFor(locale: SupportedLocale) {
  return HOMEPAGE_DEMO_BABIES[locale];
}

export function isHomepageDemoPublicId(publicId: string) {
  return SUPPORTED_LOCALES.some((locale) => HOMEPAGE_DEMO_BABIES[locale].publicId === publicId);
}
