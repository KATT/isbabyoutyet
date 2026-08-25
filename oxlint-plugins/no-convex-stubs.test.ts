import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./no-convex-stubs.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("no-invalid-convex-client", plugin.rules["no-invalid-convex-client"], {
  valid: [
    `import { createConvexTestHarness } from "@/test/convexTestHarness";
     const harness = await createConvexTestHarness({ identity: null });`,
    `import { ConvexReactClient } from "convex/react";
     new ConvexReactClient("https://real.example.com");`,
  ],
  invalid: [
    {
      code: `import { ConvexReactClient } from "convex/react";
             new ConvexReactClient("https://example.invalid");`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import { ConvexReactClient as Client } from "convex/react";
             new Client("https://example.invalid", { verbose: false });`,
      errors: [{ messageId: "banned" }],
    },
  ],
});

tester.run("no-test-preloaded-query", plugin.rules["no-test-preloaded-query"], {
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
