import { eslintCompatPlugin } from "@oxlint/plugins";

import { inferCallbackParams } from "./infer-callback-params.ts";
import { inlineJsxCallback } from "./inline-jsx-callback.ts";
import { noBannedReactReexport } from "./no-banned-react-reexport.ts";
import { noChainedTypeAssertionsRule } from "./no-chained-type-assertions.ts";
import { noConditionalEmptyObjectSpreadRule } from "./no-conditional-empty-object-spread.ts";
import { noConvexQueryHooks } from "./no-convex-query-hooks.ts";
import { noInvalidConvexClient } from "./no-invalid-convex-client.ts";
import { noKnownValueWideningRule } from "./no-known-value-widening.ts";
import { noManualMemoization } from "./no-manual-memoization.ts";
import { noMock } from "./no-mock.ts";
import { noModuleMockingRule } from "./no-module-mocking.ts";
import { noObjectParametersRule } from "./no-object-parameters.ts";
import { noOptional } from "./no-optional.ts";
import { noOverzealousDestructuring } from "./no-overzealous-destructuring.ts";
import { noReflectApplyRule } from "./no-reflect-apply.ts";
import { noReflectGetRule } from "./no-reflect-get.ts";
import { noRhfWatch } from "./no-rhf-watch.ts";
import { noRuntimeTypeofRule } from "./no-runtime-typeof.ts";
import { noForbiddenTermInSymbolNamesRule } from "./no-shape-in-symbol-names.ts";
import { noTestPreloadedQuery } from "./no-test-preloaded-query.ts";
import { noUnknownParametersRule } from "./no-unknown-parameters.ts";
import { noUnknownReturnsRule } from "./no-unknown-returns.ts";
import { noUnknownTypeAliasesRule } from "./no-unknown-type-aliases.ts";
import { noUnsafeDictionaryTypeRule } from "./no-unsafe-dictionary-type.ts";
import { noUseEffect } from "./no-use-effect.ts";
import { noUseState } from "./no-use-state.ts";
import { noWidenThenAssertRule } from "./no-widen-then-assert.ts";
import { requirePreloadedQueryOptions } from "./require-preloaded-query-options.ts";
import { requireSafetyCommentForTypeAssertionRule } from "./require-safety-comment-for-type-assertion.ts";
import { useLoaderPreloads } from "./use-loader-preloads.ts";

const plugin = eslintCompatPlugin({
  meta: {
    name: "workspace",
  },
  rules: {
    "infer-callback-params": inferCallbackParams,
    "inline-jsx-callback": inlineJsxCallback,
    "no-banned-react-reexport": noBannedReactReexport,
    "no-chained-type-assertions": noChainedTypeAssertionsRule,
    "no-conditional-empty-object-spread": noConditionalEmptyObjectSpreadRule,
    "no-convex-query-hooks": noConvexQueryHooks,
    "no-invalid-convex-client": noInvalidConvexClient,
    "no-known-value-widening": noKnownValueWideningRule,
    "no-manual-memoization": noManualMemoization,
    "no-mock": noMock,
    "no-module-mocking": noModuleMockingRule,
    "no-object-parameters": noObjectParametersRule,
    "no-optional": noOptional,
    "no-overzealous-destructuring": noOverzealousDestructuring,
    "no-reflect-apply": noReflectApplyRule,
    "no-reflect-get": noReflectGetRule,
    "no-rhf-watch": noRhfWatch,
    "no-runtime-typeof": noRuntimeTypeofRule,
    "no-shape-in-symbol-names": noForbiddenTermInSymbolNamesRule,
    "no-test-preloaded-query": noTestPreloadedQuery,
    "no-unknown-parameters": noUnknownParametersRule,
    "no-unknown-returns": noUnknownReturnsRule,
    "no-unknown-type-aliases": noUnknownTypeAliasesRule,
    "no-unsafe-dictionary-type": noUnsafeDictionaryTypeRule,
    "no-use-effect": noUseEffect,
    "no-use-state": noUseState,
    "no-widen-then-assert": noWidenThenAssertRule,
    "require-preloaded-query-options": requirePreloadedQueryOptions,
    "require-safety-comment-for-type-assertion": requireSafetyCommentForTypeAssertionRule,
    "use-loader-preloads": useLoaderPreloads,
  },
});

export default plugin;
