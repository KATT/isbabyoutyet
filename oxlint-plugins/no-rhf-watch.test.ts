import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./no-rhf-watch.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("no-rhf-watch", plugin.rules["no-rhf-watch"], {
  valid: [
    `import { useWatch } from "react-hook-form";
     const draft = useWatch({ control: form.control });`,
    `import { useFormState } from "react-hook-form";
     const { isSubmitting } = useFormState({ control: form.control });`,
    // Unrelated identifiers named watch are fine when not called as RHF watch.
    `const watch = document.querySelector("#watch");
     watch?.classList.add("on");`,
  ],
  invalid: [
    {
      code: `const draft = form.watch();`,
      errors: [{ message: /useWatch/ }],
    },
    {
      code: `const milestone = form.watch("milestone");`,
      errors: [{ message: /useWatch/ }],
    },
    {
      code: `const draft = form["watch"]();`,
      errors: [{ message: /useWatch/ }],
    },
    {
      code: `const { watch } = form;
             const draft = watch();`,
      errors: [{ message: /useWatch/ }, { message: /useWatch/ }],
    },
    {
      code: `import { watch } from "react-hook-form";
             const draft = watch(control);`,
      errors: [{ message: /useWatch/ }],
    },
  ],
});
