import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./no-use-state.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("no-use-state", plugin.rules["no-use-state"], {
  valid: [
    `import { useRef, useSyncExternalStore } from "react";`,
    `function useState() { return "a local function"; } useState();`,
    `import * as React from "react"; React.useRef(null);`,
  ],
  invalid: [
    {
      code: `import { useState } from "react";`,
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
      code: `import * as React from "react"; React.useState(0);`,
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
      code: `export { useState } from "react";`,
      errors: [{ messageId: "banned" }],
    },
  ],
});
