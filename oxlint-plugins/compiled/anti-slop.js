import { eslintCompatPlugin } from "@oxlint/plugins";
import { noChainedTypeAssertionsRule } from "./no-chained-type-assertions.js";
import { noModuleMockingRule } from "./no-module-mocking.js";
import { noReflectApplyRule } from "./no-reflect-apply.js";
import { noUnknownTypeAliasesRule } from "./no-unknown-type-aliases.js";
import { noWidenThenAssertRule } from "./no-widen-then-assert.js";
import { requireSafetyCommentForTypeAssertionRule } from "./require-safety-comment-for-type-assertion.js";
/** Generic Oxlint rules that reject low-evidence and low-signal implementation patterns. */
const antiSlopPlugin = eslintCompatPlugin({
    meta: { name: "anti-slop" },
    rules: {
        "no-chained-type-assertions": noChainedTypeAssertionsRule,
        "no-module-mocking": noModuleMockingRule,
        "no-reflect-apply": noReflectApplyRule,
        "no-unknown-type-aliases": noUnknownTypeAliasesRule,
        "no-widen-then-assert": noWidenThenAssertRule,
        "require-safety-comment-for-type-assertion": requireSafetyCommentForTypeAssertionRule,
    },
});
export default antiSlopPlugin;
