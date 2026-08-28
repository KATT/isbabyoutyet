/**
 * Disallow TypeScript optional (`?`) markers on properties and parameters.
 *
 * Prefer required keys with an explicit `| undefined` / `| null` union so
 * callers must pass the value (including absence) rather than omitting it.
 */

import { defineRule } from "@oxlint/plugins";

const MESSAGE =
  "Optional `?` is not allowed. Use a required property/parameter with `| undefined` or `| null` instead.";

function reportOptional(context, node) {
  context.report({ message: MESSAGE, node });
}

function checkFunctionParams(context, node) {
  for (const param of node.params) {
    if (param.optional) {
      reportOptional(context, param);
    }
  }
}

const noOptional = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow optional (`?`) TypeScript properties and function parameters",
    },
    schema: [],
    messages: {
      default: MESSAGE,
    },
  },

  create(context) {
    return {
      TSPropertySignature(node) {
        if (node.optional) {
          reportOptional(context, node);
        }
      },

      TSMethodSignature(node) {
        if (node.optional) {
          reportOptional(context, node);
        }
        checkFunctionParams(context, node);
      },

      TSNamedTupleMember(node) {
        if (node.optional) {
          reportOptional(context, node);
        }
      },

      PropertyDefinition(node) {
        if (node.optional) {
          reportOptional(context, node);
        }
      },

      FunctionDeclaration(node) {
        checkFunctionParams(context, node);
      },

      FunctionExpression(node) {
        checkFunctionParams(context, node);
      },

      ArrowFunctionExpression(node) {
        checkFunctionParams(context, node);
      },

      TSDeclareFunction(node) {
        checkFunctionParams(context, node);
      },

      TSEmptyBodyFunctionExpression(node) {
        checkFunctionParams(context, node);
      },

      TSFunctionType(node) {
        checkFunctionParams(context, node);
      },

      TSCallSignatureDeclaration(node) {
        checkFunctionParams(context, node);
      },

      TSConstructSignatureDeclaration(node) {
        checkFunctionParams(context, node);
      },
    };
  },
});

export { noOptional };
