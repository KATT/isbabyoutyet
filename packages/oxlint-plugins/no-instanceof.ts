import { defineRule } from "@oxlint/plugins";

/**
 * Ban `instanceof` except for `*Error` / `*Exception` constructors.
 *
 * Ported from `@nkzw/eslint-plugin` (`no-instanceof`) so we can keep the
 * nkzw oxlint-config rule without depending on that package.
 */

const MESSAGE = 'The "instanceof" operator is not allowed.';

const noInstanceof = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow instanceof except for Error and Exception constructors",
    },
    schema: [],
    messages: {
      banned: MESSAGE,
    },
  },

  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator !== "instanceof") {
          return;
        }
        if (
          node.right.type === "Identifier" &&
          (node.right.name.endsWith("Error") || node.right.name.endsWith("Exception"))
        ) {
          return;
        }
        context.report({ node, messageId: "banned" });
      },
    };
  },
});

export { noInstanceof };
