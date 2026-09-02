import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./workspace.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("ensure-relay-types", plugin.rules["ensure-relay-types"], {
  valid: [
    `import { useMutation } from "react-relay/hooks.js"; useMutation<Mut>(mutation, options);`,
    `import { usePaginationFragment } from "react-relay/hooks.js"; usePaginationFragment<Frag>(fragment, options);`,
    `useMutation(mutation, options);`,
  ],
  invalid: [
    {
      code: `import { useMutation } from "react-relay/hooks.js"; useMutation(mutation, options);`,
      errors: [{ messageId: "missing" }],
    },
    {
      code: `import { usePaginationFragment } from "react-relay/hooks.js"; usePaginationFragment(fragment, options);`,
      errors: [{ messageId: "missing" }],
    },
  ],
});
