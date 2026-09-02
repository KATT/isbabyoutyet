import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./workspace.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("require-use-effect-arguments", plugin.rules["require-use-effect-arguments"], {
  valid: [
    `import { useEffect } from "react"; useEffect(() => {}, []);`,
    `import { useEffect } from "react"; useEffect(() => {}, [a]);`,
    `import { useEffect } from "react"; useEffect(() => {}, undefined);`,
    `import { useEffect as uE } from "react"; uE(() => {}, undefined);`,
    `import R from "react"; R.useEffect(() => {}, undefined);`,
    `useEffect(() => {});`,
  ],
  invalid: [
    {
      code: `import { useEffect } from "react"; useEffect(() => {});`,
      errors: [{ messageId: "missing" }],
    },
    {
      code: `import { useEffect as uE } from "react"; uE(() => {});`,
      errors: [{ messageId: "missing" }],
    },
    {
      code: `import R from "react"; R.useEffect(() => {});`,
      errors: [{ messageId: "missing" }],
    },
  ],
});
