import { getRequestHeader } from "@tanstack/react-start/server";
import { resolveAcceptLanguage } from "./accept-language";

export function detectLocaleFromRequestHeaders(
  _serverContext?: unknown,
  readHeader: (name: string) => string | undefined = getRequestHeader,
) {
  return resolveAcceptLanguage(readHeader("accept-language") ?? null);
}
