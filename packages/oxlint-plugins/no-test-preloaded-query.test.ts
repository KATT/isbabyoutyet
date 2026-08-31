import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import { noTestPreloadedQuery } from "./no-test-preloaded-query.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("no-test-preloaded-query", noTestPreloadedQuery, {
  valid: [
    `import { runRouteLoader } from "@/test/routeTestContext";
     await runRouteLoader({ harness, route: Route });`,
    `import { testPreloadedConvexQuery } from "./test-helpers";
     testPreloadedConvexQuery({ input: {}, initialData: null });`,
  ],
  invalid: [
    {
      code: `import { testPreloadedConvexQuery } from "@workspace/convex-prefetch/test-helpers";`,
      errors: [{ messageId: "importBanned" }],
    },
    {
      code: `import { testPreloadedConvexInfiniteQuery as preload } from "@workspace/convex-prefetch/test-helpers";
             preload({ input: {}, numItems: 10, initialData: { pages: [], pageParams: [] } });`,
      errors: [{ messageId: "importBanned" }, { messageId: "callBanned" }],
    },
  ],
});
