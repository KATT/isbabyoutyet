import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./no-mock.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("no-mock", plugin.rules["no-mock"], {
  valid: [
    `import { vi } from "vitest";
     const fn = vi.fn();
     fn();`,
    `import { vi } from "vitest";
     const spy = vi.spyOn(console, "log");
     spy.mockRestore();`,
    `import { expect } from "vitest";
     expect(true).toBe(true);`,
  ],
  invalid: [
    {
      code: `import { vi } from "vitest";
             vi.mock("./mod", () => ({}));`,
      errors: [{ message: /banned: vi\.mock/ }],
    },
    {
      code: `import { vi } from "vitest";
             vi.hoisted(() => ({ x: 1 }));`,
      errors: [{ message: /banned: vi\.hoisted/ }],
    },
    {
      code: `import { vi } from "vitest";
             vi.doMock("./mod");`,
      errors: [{ message: /banned: vi\.doMock/ }],
    },
    {
      code: `import { vi } from "vitest";
             vi["mock"]("./mod", () => ({}));`,
      errors: [{ message: /banned: vi\.mock/ }],
    },
    {
      code: `import { jest } from "@jest/globals";
             jest.mock("./mod");`,
      errors: [{ message: /banned: jest\.mock/ }],
    },
  ],
});
