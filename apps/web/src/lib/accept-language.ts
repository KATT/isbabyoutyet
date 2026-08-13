import {
  DEFAULT_LOCALE,
  resolveSupportedLocale,
  type SupportedLocale,
} from "@workspace/convex/src/i18n";

export function resolveAcceptLanguage(acceptLanguage: string | null): SupportedLocale {
  for (const preference of acceptLanguage?.split(",") ?? []) {
    const languageTag = preference.split(";")[0]?.trim();
    if (!languageTag) {
      continue;
    }
    const baseLanguage = languageTag.split("-")[0]?.toLowerCase();
    if (baseLanguage === "en" || baseLanguage === "sv" || baseLanguage === "es") {
      return resolveSupportedLocale(languageTag);
    }
  }
  return DEFAULT_LOCALE;
}
