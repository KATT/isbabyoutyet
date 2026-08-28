import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./no-use-state.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("no-use-state", plugin.rules["no-use-state"], {
  valid: [
    `import { useRef, useTransition } from "react";`,
    `function useState() { return "a local function"; } useState();`,
    `import * as React from "react"; React.useRef(null);`,
  ],
  invalid: [
    {
      code: `import { useState } from "react";`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import { useReducer } from "react";`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import { useActionState } from "react";`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import { useOptimistic } from "react";`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import { useSyncExternalStore } from "react";`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import { useState as localState } from "react";`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import React from "react"; React.useState(false);`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import * as React from "react"; React.useReducer((s) => s, 0);`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import * as React from "react"; React["useState"](0);`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import * as React from "react"; const { useState } = React;`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import * as React from "react"; React.useSyncExternalStore(() => () => {}, () => 0);`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `export { useState } from "react";`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `export { useOptimistic } from "react";`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `export { useSyncExternalStore } from "react";`,
      errors: [{ messageId: "banned" }],
    },
  ],
});
