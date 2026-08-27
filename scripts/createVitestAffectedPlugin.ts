import { vitestAffected } from "vitest-affected";

/**
 * Shared vitest-affected options for package-level Vitest configs.
 *
 * Selection is opt-in: set `VITEST_AFFECTED_REF` (CI PR base SHA) or
 * `VITEST_AFFECTED=1`. Root multi-project `pnpm test` is unaffected (plugin
 * skips when multiple projects exist; root config does not load this helper).
 */
export function createVitestAffectedPlugin() {
  const ref = process.env["VITEST_AFFECTED_REF"];
  const hasRef = ref !== undefined && ref !== "";
  const enabled =
    hasRef ||
    process.env["VITEST_AFFECTED"] === "1" ||
    process.env["VITEST_AFFECTED_DISABLED"] === "0";
  const disabled =
    process.env["VITEST_AFFECTED_DISABLED"] === "1" || !enabled;

  if (hasRef) {
    return vitestAffected({
      ref,
      disabled,
      verbose: process.env["CI"] === "true",
      statsFile: ".vitest-affected/stats.jsonl",
      allowNoTests: false,
    });
  }

  return vitestAffected({
    disabled,
    verbose: process.env["CI"] === "true",
    statsFile: ".vitest-affected/stats.jsonl",
    allowNoTests: false,
  });
}
