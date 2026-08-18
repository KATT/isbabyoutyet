import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./prefer-param-access.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("prefer-param-access", plugin.rules["prefer-param-access"], {
  valid: [
    `function Card(props: Props) {
       return <h1>{props.title}{props.subtitle}</h1>;
     }`,
    `function Card(props: Props) {
       const baby = props.baby;
       return <>{baby.name}{baby.dueDate}{baby.status}</>;
     }`,
    `function Form(props: Props) {
       const { id, ...rest } = props.form;
       return <Provider {...rest} id={id} />;
     }`,
    `function Field({ field }: FieldProps) {
       return <Input {...field} />;
     }`,
    {
      filename: "src/routeTree.gen.ts",
      code: `function generated({ route }: Props) {
        const value = route.value;
        return value;
      }`,
    },
  ],
  invalid: [
    {
      code: `function Card(props: Props) {
        const title = props.title;
        return <h1>{title}{title}</h1>;
      }`,
      errors: [
        {
          messageId: "direct",
          data: { name: "title", count: 2, member: "props.title" },
          suggestions: [
            {
              messageId: "inlineSuggestion",
              output: `function Card(props: Props) {
        return <h1>{props.title}{props.title}</h1>;
      }`,
            },
          ],
        },
      ],
    },
    {
      code: `function Card(props: Props) {
        const title = props.title;
        return { title };
      }`,
      errors: [
        {
          messageId: "direct",
          suggestions: [
            {
              messageId: "inlineSuggestion",
              output: `function Card(props: Props) {
        return { title: props.title };
      }`,
            },
          ],
        },
      ],
    },
    {
      code: `function Card({ title }: Props) {
        return <h1>{title}</h1>;
      }`,
      errors: [{ messageId: "parameter", suggestions: null }],
    },
    {
      code: `function Card(props: Props) {
        const { title } = props;
        return <h1>{title}</h1>;
      }`,
      errors: [
        {
          messageId: "direct",
          suggestions: [
            {
              messageId: "inlineSuggestion",
              output: `function Card(props: Props) {
        return <h1>{props.title}</h1>;
      }`,
            },
          ],
        },
      ],
    },
    {
      code: `function Card(props: Props) {
        const { title, baby } = props;
        consume(baby);
        consume(baby);
        consume(baby);
        return <h1>{title}{title}</h1>;
      }`,
      errors: [
        {
          messageId: "direct",
          data: { name: "title", count: 2, member: "props.title" },
          suggestions: null,
        },
      ],
    },
  ],
});
