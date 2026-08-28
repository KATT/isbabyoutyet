import { eslintCompatPlugin } from "@oxlint/plugins";

import type { Plugin, Rule } from "@oxlint/plugins";

/** Wrap one rule as a standalone Oxlint jsPlugin (same shape as no-use-state, etc.). */
export function createRulePlugin(name: string, rule: Rule): Plugin {
  return eslintCompatPlugin({
    meta: { name },
    rules: { [name]: rule },
  });
}
