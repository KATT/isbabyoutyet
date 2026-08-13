import { expect, test } from "vitest";
import { resolveAcceptLanguage } from "./detect-locale";
import { getLanguageName } from "./i18n";

test.each([
  ["sv-SE,sv;q=0.9,en;q=0.7", "sv"],
  ["es-MX,es;q=0.9", "es"],
  ["en-US,en;q=0.9", "en-US"],
  ["en-AU,en;q=0.9", "en-GB"],
  ["fr-FR,es;q=0.8", "es"],
  ["fr-FR,fr;q=0.9", "en-GB"],
  ["", "en-GB"],
  [null, "en-GB"],
] as const)("resolves Accept-Language %s to %s", (header, expected) => {
  expect(resolveAcceptLanguage(header)).toBe(expected);
});

test("displays supported language names in the active language", () => {
  expect(getLanguageName("sv", "es").toLocaleLowerCase("es")).toContain("sueco");
});
