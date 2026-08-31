import { defineRule } from "@oxlint/plugins";

/**
 * Disallow `expect(expr).toBe(expr)` / `toEqual` / `toStrictEqual`.
 *
 * Tautological tests considered harmful: an assertion that repeats the actual
 * expression as the expected value passes by construction and cannot disagree
 * with the code. Expected values must be independent literals or spec values.
 */

const MATCHERS = new Set(["toBe", "toEqual", "toStrictEqual"]);

function memberName(property, computed) {
  if (!computed && property.type === "Identifier") {
    return property.name;
  }
  if (computed && property.type === "Literal" && typeof property.value === "string") {
    return property.value;
  }
  return null;
}

function normalizeSource(text) {
  return text.replace(/\s+/g, " ").trim();
}

export const noTautologicalExpect = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow tautological expect() assertions that repeat the actual expression as the expected value",
    },
    schema: [],
    messages: {
      tautological:
        "Tautological tests considered harmful. Expected values must be an independent literal or spec value, not the same expression as the actual.",
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression" || node.arguments.length === 0) {
          return;
        }
        const matcher = memberName(node.callee.property, node.callee.computed);
        if (matcher == null || !MATCHERS.has(matcher)) {
          return;
        }
        const expectCall = node.callee.object;
        if (
          expectCall.type !== "CallExpression" ||
          expectCall.callee.type !== "Identifier" ||
          expectCall.callee.name !== "expect" ||
          expectCall.arguments.length === 0
        ) {
          return;
        }
        const actual = expectCall.arguments[0];
        const expected = node.arguments[0];
        if (actual.type === "SpreadElement" || expected.type === "SpreadElement") {
          return;
        }
        const actualText = normalizeSource(context.sourceCode.getText(actual));
        const expectedText = normalizeSource(context.sourceCode.getText(expected));
        if (actualText !== expectedText) {
          return;
        }
        context.report({ node, messageId: "tautological" });
      },
    };
  },
});
