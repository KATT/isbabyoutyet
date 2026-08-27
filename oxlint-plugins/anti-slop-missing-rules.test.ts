import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import antiSlopPlugin from "./anti-slop";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

tester.run(
  "anti-slop/no-chained-type-assertions",
  antiSlopPlugin.rules["no-chained-type-assertions"],
  {
    valid: ["declare const value: string; const result = value as string;"],
    invalid: [
      {
        code: "declare const value: unknown; const result = value as object as { id: string };",
        errors: [{ messageId: "chained" }],
      },
    ],
  },
);
