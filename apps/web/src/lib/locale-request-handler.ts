import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { isSupportedLocale } from "@workspace/convex/src/i18n";
import { resolveAcceptLanguage } from "./accept-language";

export function detectLocaleFromRequestHeaders(
  _serverContext?: unknown,
  readHeader: (name: string) => string | undefined = getRequestHeader,
  readCookie: (name: string) => string | undefined = getCookie,
) {
  const savedLocale = readCookie("PARAGLIDE_LOCALE");
  if (savedLocale && isSupportedLocale(savedLocale)) {
    return savedLocale;
  }
  return resolveAcceptLanguage(readHeader("accept-language") ?? null);
}
