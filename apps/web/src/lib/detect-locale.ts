import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
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

export function detectLocaleFromRequestHeaders(
  _serverContext?: unknown,
  readHeader: (name: string) => string | undefined = getRequestHeader,
) {
  return resolveAcceptLanguage(readHeader("accept-language") ?? null);
}

export const detectRequestLocale = createServerFn({ method: "GET" }).handler(
  detectLocaleFromRequestHeaders,
);
