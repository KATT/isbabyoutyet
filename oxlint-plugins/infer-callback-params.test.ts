import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./infer-callback-params.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("infer-callback-params", plugin.rules["infer-callback-params"], {
  valid: [
    `items.map((item) => item.id);`,
    `const button = <Button onClick={(event) => event.preventDefault()} />;`,
    `useMutation({
       mutationFn: async (value) => save(value),
     });`,
    `function parse(value: string) {
       return Number(value);
     }`,
    `const parse = (value: string) => Number(value);`,
    `const helpers = {
       parse: (value: string) => Number(value),
     };`,
    {
      filename: "src/routeTree.gen.ts",
      code: `items.map((item: Item) => item.id);`,
    },
  ],
  invalid: [
    {
      code: `items.map((item: Item) => item.id);`,
      output: `items.map((item) => item.id);`,
      errors: [{ messageId: "infer" }],
    },
    {
      code: `const button = <Button onClick={(event: MouseEvent) => event.preventDefault()} />;`,
      output: `const button = <Button onClick={(event) => event.preventDefault()} />;`,
      errors: [{ messageId: "infer" }],
    },
    {
      code: `useMutation({
        mutationFn: async (value: Input) => save(value),
      });`,
      output: `useMutation({
        mutationFn: async (value) => save(value),
      });`,
      errors: [{ messageId: "infer" }],
    },
    {
      code: `router.use({
        nested: {
          handler: function ({ request }: HandlerContext) {
            return request.url;
          },
        },
      });`,
      output: `router.use({
        nested: {
          handler: function ({ request }) {
            return request.url;
          },
        },
      });`,
      errors: [{ messageId: "infer" }],
    },
    {
      code: `promise.catch((error: unknown) => report(error));`,
      output: `promise.catch((error) => report(error));`,
      errors: [{ messageId: "infer" }],
    },
  ],
});
