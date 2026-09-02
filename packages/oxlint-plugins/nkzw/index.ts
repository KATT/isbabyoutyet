import { eslintCompatPlugin } from "@oxlint/plugins";

import { ensureRelayTypesRule } from "./rules/ensure-relay-types.ts";
import { noInstanceofRule } from "./rules/no-instanceof.ts";
import { requireUseEffectArgumentsRule } from "./rules/require-use-effect-arguments.ts";

/** Vendored from https://github.com/nkzw-tech/eslint-plugin — see AGENTS.md for sync steps. */
const nkzwPlugin = eslintCompatPlugin({
  meta: { name: "nkzw" },
  rules: {
    "ensure-relay-types": ensureRelayTypesRule,
    "no-instanceof": noInstanceofRule,
    "require-use-effect-arguments": requireUseEffectArgumentsRule,
  },
});

export default nkzwPlugin;
