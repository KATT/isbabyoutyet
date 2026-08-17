import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./react-compiler.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("no-use-memo", plugin.rules["no-use-memo"], {
  valid: [
    `import * as React from "react";
     React.useState(0);`,
    `import { useState } from "react";
     useState(0);`,
  ],
  invalid: [
    {
      code: `import { useMemo } from "react";
             useMemo(() => 1, []);`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import { useMemo as memoize } from "react";
             memoize(() => 1, []);`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import * as React from "react";
             React.useMemo(() => 1, []);`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `react["useMemo"](() => 1, []);`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `const { useMemo } = React;`,
      errors: [{ messageId: "banned" }],
    },
  ],
});
