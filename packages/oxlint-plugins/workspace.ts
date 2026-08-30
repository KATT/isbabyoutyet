import { eslintCompatPlugin } from "@oxlint/plugins";

import { inferCallbackParams } from "./infer-callback-params.ts";
import { inlineJsxCallback } from "./inline-jsx-callback.ts";
import { noBannedReactReexport } from "./no-banned-react-reexport.ts";
import { noConvexQueryHooks } from "./no-convex-query-hooks.ts";
import { noInvalidConvexClient } from "./no-invalid-convex-client.ts";
import { noManualMemoization } from "./no-manual-memoization.ts";
import { noMock } from "./no-mock.ts";
import { noOptional } from "./no-optional.ts";
import { noOverzealousDestructuring } from "./no-overzealous-destructuring.ts";
import { noRhfWatch } from "./no-rhf-watch.ts";
import { noTestPreloadedQuery } from "./no-test-preloaded-query.ts";
import { noUseEffect } from "./no-use-effect.ts";
import { noUseState } from "./no-use-state.ts";
import { requirePreloadedQueryOptions } from "./require-preloaded-query-options.ts";
import { useLoaderPreloads } from "./use-loader-preloads.ts";

const plugin = eslintCompatPlugin({
  meta: {
    name: "workspace",
  },
  rules: {
    "infer-callback-params": inferCallbackParams,
    "inline-jsx-callback": inlineJsxCallback,
    "no-banned-react-reexport": noBannedReactReexport,
    "no-convex-query-hooks": noConvexQueryHooks,
    "no-invalid-convex-client": noInvalidConvexClient,
    "no-manual-memoization": noManualMemoization,
    "no-mock": noMock,
    "no-optional": noOptional,
    "no-overzealous-destructuring": noOverzealousDestructuring,
    "no-rhf-watch": noRhfWatch,
    "no-test-preloaded-query": noTestPreloadedQuery,
    "no-use-effect": noUseEffect,
    "no-use-state": noUseState,
    "require-preloaded-query-options": requirePreloadedQueryOptions,
    "use-loader-preloads": useLoaderPreloads,
  },
});

export default plugin;
