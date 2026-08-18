import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./inline-single-use-helper.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("inline-single-use-helper", plugin.rules["inline-single-use-helper"], {
  valid: [
    `function parse(value: string) {
       return Number(value);
     }
     const first = parse("1");
     const second = parse("2");`,
    `function Page() {
       function save() {
         persist();
       }
       return <Button onClick={save} />;
     }`,
    `function parse(value: string) {
       return Number(value);
     }
     const values = inputs.map((input) => parse(input));`,
    `export function parse(value: string) {
       return Number(value);
     }
     parse("1");`,
    `function useProfile() {
       return getProfile();
     }
     useProfile();`,
    {
      filename: "src/routeTree.gen.ts",
      code: `function parse(value: string) {
        return Number(value);
      }
      parse("1");`,
    },
  ],
  invalid: [
    {
      code: `function parse(value: string) {
        return Number(value);
      }
      const result = parse("1");`,
      errors: [
        {
          messageId: "inline",
          suggestions: [
            {
              messageId: "inlineSuggestion",
              output: `const result = (function (value: string) {
        return Number(value);
      })("1");`,
            },
          ],
        },
      ],
    },
    {
      code: `const parse = (value: string) => Number(value);
      const result = parse("1");`,
      errors: [
        {
          messageId: "inline",
          suggestions: [
            {
              messageId: "inlineSuggestion",
              output: `const result = ((value: string) => Number(value))("1");`,
            },
          ],
        },
      ],
    },
    {
      code: `const parse = (value: string) => Number(value), stringify = String;
      const result = parse("1");`,
      errors: [{ messageId: "inline", suggestions: null }],
    },
    {
      code: `const values = inputs.map((input) => {
        function parse(value: string) {
          return Number(value);
        }
        return parse(input);
      });`,
      errors: [
        {
          messageId: "inline",
          suggestions: [
            {
              messageId: "inlineSuggestion",
              output: `const values = inputs.map((input) => {
        return (function (value: string) {
          return Number(value);
        })(input);
      });`,
            },
          ],
        },
      ],
    },
  ],
});
