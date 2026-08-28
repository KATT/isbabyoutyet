import { eslintCompatPlugin } from "@oxlint/plugins";

import { noChainedTypeAssertionsRule } from "./no-chained-type-assertions.ts";
import { noConditionalEmptyObjectSpreadRule } from "./no-conditional-empty-object-spread.ts";
import { noKnownValueWideningRule } from "./no-known-value-widening.ts";
import { noModuleMockingRule } from "./no-module-mocking.ts";
import { noObjectParametersRule } from "./no-object-parameters.ts";
import { noReflectApplyRule } from "./no-reflect-apply.ts";
import { noReflectGetRule } from "./no-reflect-get.ts";
import { noRuntimeTypeofRule } from "./no-runtime-typeof.ts";
import { noForbiddenTermInSymbolNamesRule } from "./no-shape-in-symbol-names.ts";
import { noUnknownParametersRule } from "./no-unknown-parameters.ts";
import { noUnknownReturnsRule } from "./no-unknown-returns.ts";
import { noUnknownTypeAliasesRule } from "./no-unknown-type-aliases.ts";
import { noUnsafeDictionaryTypeRule } from "./no-unsafe-dictionary-type.ts";
import { noWidenThenAssertRule } from "./no-widen-then-assert.ts";
import { requireSafetyCommentForTypeAssertionRule } from "./require-safety-comment-for-type-assertion.ts";

/** Generic Oxlint rules that reject low-evidence and low-signal implementation patterns. */
const antiSlopPlugin = eslintCompatPlugin({
  meta: { name: "anti-slop" },
  rules: {
    "no-chained-type-assertions": noChainedTypeAssertionsRule,
    "no-conditional-empty-object-spread": noConditionalEmptyObjectSpreadRule,
    "no-known-value-widening": noKnownValueWideningRule,
    "no-module-mocking": noModuleMockingRule,
    "no-object-parameters": noObjectParametersRule,
    "no-reflect-apply": noReflectApplyRule,
    "no-reflect-get": noReflectGetRule,
    "no-runtime-typeof": noRuntimeTypeofRule,
    "no-shape-in-symbol-names": noForbiddenTermInSymbolNamesRule,
    "no-unknown-parameters": noUnknownParametersRule,
    "no-unknown-returns": noUnknownReturnsRule,
    "no-unknown-type-aliases": noUnknownTypeAliasesRule,
    "no-unsafe-dictionary-type": noUnsafeDictionaryTypeRule,
    "no-widen-then-assert": noWidenThenAssertRule,
    "require-safety-comment-for-type-assertion": requireSafetyCommentForTypeAssertionRule,
  },
});

export default antiSlopPlugin;
