import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./no-banned-react-reexport.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("no-banned-react-reexport", plugin.rules["no-banned-react-reexport"], {
  valid: [
    `export { useRef, useTransition } from "react";`,
    `export { Button } from "@workspace/ui-cssinjs/components/button";`,
    `import { useState } from "react"; export function useThing() { return useState(0); }`,
    `import { useRef } from "react"; export { useRef };`,
  ],
  invalid: [
    {
      code: `export { useEffect } from "react";`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `export { useState } from "react";`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `export { useReducer, useOptimistic } from "react";`,
      errors: [{ messageId: "banned" }, { messageId: "banned" }],
    },
    {
      code: `export { useLayoutEffect as afterPaint } from "react";`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `export * from "react";`,
      errors: [{ messageId: "star" }],
    },
    {
      code: `import { useState } from "react"; export { useState };`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import { useEffect as runAfterPaint } from "react"; export { runAfterPaint };`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import { useOptimistic as opt } from "react"; export { opt as useOptimistic };`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import { useState } from "react"; export const useLocalState = useState;`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import { useEffect } from "react"; export default useEffect;`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `export { useSyncExternalStore } from "react";`,
      errors: [{ messageId: "banned" }],
    },
  ],
});
