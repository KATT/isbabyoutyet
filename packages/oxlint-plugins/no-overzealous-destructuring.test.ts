import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./workspace.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("no-overzealous-destructuring", plugin.rules["no-overzealous-destructuring"], {
  valid: [
    `function Card(props: Props) {
         return <h1>{props.title}{props.subtitle}</h1>;
       }`,
    `function Card(props: Props) {
         const title = props.title;
         return <h1>{title}{title}</h1>;
       }`,
    `function Subscribe(props: Props) {
         const { babyId } = props;
         save(babyId);
         track(babyId);
         return <Link id={babyId} />;
       }`,
    `function Card({ baby }: Props) {
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
          return route.value;
        }`,
    },
  ],
  invalid: [
    {
      code: `function Card(props: Props) {
          const { title } = props;
          return <h1>{title}{title}</h1>;
        }`,
      errors: [
        {
          messageId: "body",
          data: { name: "title", count: 2, member: "props.title" },
          suggestions: [
            {
              messageId: "directSuggestion",
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
          const { title, baby } = props;
          consume(baby);
          consume(baby);
          consume(baby);
          return <h1>{title}{title}</h1>;
        }`,
      errors: [
        {
          messageId: "body",
          data: { name: "title", count: 2, member: "props.title" },
          suggestions: null,
        },
      ],
    },
    {
      code: `function Card({ title }: Props) {
          return <h1>{title}</h1>;
        }`,
      errors: [
        {
          messageId: "parameter",
          data: { name: "title", count: 1 },
          suggestions: null,
        },
      ],
    },
    {
      code: `function Card({ title = "Untitled" }: Props) {
          return <h1>{title}</h1>;
        }`,
      errors: [
        {
          messageId: "parameter",
          data: { name: "title", count: 1 },
          suggestions: null,
        },
      ],
    },
  ],
});
