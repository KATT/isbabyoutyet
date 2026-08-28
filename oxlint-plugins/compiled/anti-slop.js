import { eslintCompatPlugin } from "@oxlint/plugins";
import { noChainedTypeAssertionsRule } from "./no-chained-type-assertions.js";
import { noConditionalEmptyObjectSpreadRule } from "./no-conditional-empty-object-spread.js";
import { noKnownValueWideningRule } from "./no-known-value-widening.js";
import { noModuleMockingRule } from "./no-module-mocking.js";
import { noObjectParametersRule } from "./no-object-parameters.js";
import { noReflectApplyRule } from "./no-reflect-apply.js";
import { noReflectGetRule } from "./no-reflect-get.js";
import { noRuntimeTypeofRule } from "./no-runtime-typeof.js";
import { noForbiddenTermInSymbolNamesRule } from "./no-shape-in-symbol-names.js";
import { noUnknownParametersRule } from "./no-unknown-parameters.js";
import { noUnknownReturnsRule } from "./no-unknown-returns.js";
import { noUnknownTypeAliasesRule } from "./no-unknown-type-aliases.js";
import { noUnsafeDictionaryTypeRule } from "./no-unsafe-dictionary-type.js";
import { noWidenThenAssertRule } from "./no-widen-then-assert.js";
import { requireSafetyCommentForTypeAssertionRule } from "./require-safety-comment-for-type-assertion.js";
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
