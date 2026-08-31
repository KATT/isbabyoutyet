import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./workspace.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("no-tautological-expect", plugin.rules["no-tautological-expect"], {
  valid: [
    `expect(add(1, 2)).toBe(3);`,
    `expect(compute(files)).toBe("abc123");`,
    `expect(htmlButton(button)).toBe(button);`,
    `expect(options.initialData).toEqual(handle.initialData);`,
    `expect(left).not.toBe(right);`,
    `expect(fn()).toBe(otherFn());`,
    `expect(value).toMatchObject({ id: "1" });`,
  ],
  invalid: [
    {
      code: `expect(true).toBe(true);`,
      errors: [{ messageId: "tautological" }],
    },
    {
      code: `expect(fn(x)).toBe(fn(x));`,
      errors: [{ messageId: "tautological" }],
    },
    {
      code: `expect(browserImageFactory(url).queryKey).toEqual(browserImageFactory(url).queryKey);`,
      errors: [{ messageId: "tautological" }],
    },
    {
      code: `expect(computeSchemaFingerprint(files)).toBe(computeSchemaFingerprint(files));`,
      errors: [{ messageId: "tautological" }],
    },
    {
      code: `expect(compute(files))["toEqual"](compute(files));`,
      errors: [{ messageId: "tautological" }],
    },
    {
      code: `expect(value).toStrictEqual(value);`,
      errors: [{ messageId: "tautological" }],
    },
  ],
});
