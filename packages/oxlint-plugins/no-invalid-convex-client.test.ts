import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import { noInvalidConvexClient } from "./no-invalid-convex-client.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("no-invalid-convex-client", noInvalidConvexClient, {
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
