import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./no-convex-optional.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

const undocumented = { messageId: "undocumented" as const };

tester.run("no-undocumented-optional", plugin.rules["no-undocumented-optional"], {
  valid: [
    `import { v } from "convex/values";
       export default defineSchema({
         baby: defineTable({
           name: v.string(),
           dueDate: v.union(v.string(), v.null()),
         }),
       });`,
    `import { v } from "convex/values";
       export const create = mutation({
         args: {
           theme: v.union(v.string(), v.null()),
         },
       });`,
    `import { v } from "convex/values";
       export default defineSchema({
         baby: defineTable({
           /**
            * @todo Optional until every row sets this key.
            */
           theme: v.optional(v.union(v.string(), v.null())),
         }),
       });`,
    `import { v } from "convex/values";
       /** @todo Optional until callers pass null. */
       const localeArg = v.optional(v.string());`,
    `import { v } from "convex/values";
       /** @todo Keep mirroring the migrations runner. */
       export const runAll = internalMutation({
         args: {
           /** @todo Keep mirroring the migrations runner. */
           dryRun: v.optional(v.boolean()),
         },
       });`,
    `import { v as validators } from "convex/values";
       const args = {
         /** @deprecated Optional until callers pass null. */
         visitorId: validators.optional(v.string()),
       };`,
    `import * as values from "convex/values";
       const args = {
         /** @todo Optional until callers pass null. */
         visitorId: values.v.optional(values.v.string()),
       };`,
    // Not from convex/values.
    `const v = { optional: (x) => x };
       const theme = v.optional("x");`,
    {
      filename: "packages/convex/convex/convex.config.ts",
      code: `import { v } from "convex/values";
               const app = defineApp({
                 env: { SITE_URL: v.optional(v.string()) },
               });`,
    },
  ],
  invalid: [
    {
      code: `import { v } from "convex/values";
               export default defineSchema({
                 baby: defineTable({
                   theme: v.optional(v.union(v.string(), v.null())),
                 }),
               });`,
      errors: [undocumented],
    },
    {
      code: `import { v } from "convex/values";
               export const create = mutation({
                 args: {
                   birthJourney: v.optional(v.string()),
                 },
               });`,
      errors: [undocumented],
    },
    {
      code: `import { v } from "convex/values";
               const localeArg = v.optional(v.string());`,
      errors: [undocumented],
    },
    {
      // Line comments are not JSDoc.
      code: `import { v } from "convex/values";
               // @deprecated not a jsdoc
               const localeArg = v.optional(v.string());`,
      errors: [undocumented],
    },
    {
      // Non-JSDoc block comments do not count.
      code: `import { v } from "convex/values";
               /* @todo not a jsdoc */
               const localeArg = v.optional(v.string());`,
      errors: [undocumented],
    },
    {
      code: `import { v as validators } from "convex/values";
               const args = { visitorId: validators.optional(validators.string()) };`,
      errors: [undocumented],
    },
    {
      code: `import * as values from "convex/values";
               const args = { visitorId: values.v.optional(values.v.string()) };`,
      errors: [undocumented],
    },
    {
      code: `import { v } from "convex/values";
               const args = { visitorId: v["optional"](v.string()) };`,
      errors: [undocumented],
    },
  ],
});
