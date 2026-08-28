import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import plugin from "./workspace.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

tester.run("no-optional", plugin.rules["no-optional"], {
  valid: [
    "type Props = { onClose: (() => void) | null };",
    "function load(id: string, visitorId: string | undefined) {}",
  ],
  invalid: [
    {
      code: "type Props = { onClose?: () => void };",
      errors: [
        {
          message:
            "Optional `?` is not allowed. Use a required property/parameter with `| undefined` or `| null` instead.",
        },
      ],
    },
    {
      code: "function load(id: string, visitorId?: string) {}",
      errors: [
        {
          message:
            "Optional `?` is not allowed. Use a required property/parameter with `| undefined` or `| null` instead.",
        },
      ],
    },
  ],
});
