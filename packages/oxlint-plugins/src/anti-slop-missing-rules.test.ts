import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import antiSlopPlugin from "./anti-slop.ts";

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

tester.run("anti-slop/no-shape-in-symbol-names", antiSlopPlugin.rules["no-shape-in-symbol-names"], {
  valid: ["interface UserRecord { id: string }"],
  invalid: [
    {
      code: "interface UserShape { id: string }",
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
  ],
});

tester.run("anti-slop/no-unknown-parameters", antiSlopPlugin.rules["no-unknown-parameters"], {
  valid: ["function enrich(cause: unknown): void {}", "function parse(value: string): void {}"],
  invalid: [
    {
      code: "function parse(value: unknown): void {}",
      errors: [{ messageId: "unknownParameter" }],
    },
  ],
});
