import { defineRule } from "@oxlint/plugins";

function importedName(node) {
  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

const TRACKED_HOOKS = new Set(["useMutation", "usePaginationFragment"]);

export const ensureRelayTypesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require type parameters on react-relay mutation and pagination hooks",
    },
    schema: [],
    messages: {
      missing: "`{{name}}` calls must have type parameters.",
    },
  },

  create(context) {
    const trackedHooks = new Set();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== "react-relay/hooks.js") {
          return;
        }
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier" && TRACKED_HOOKS.has(importedName(specifier))) {
            trackedHooks.add(specifier.local.name);
          }
        }
      },

      CallExpression(node) {
        if (node.callee.type !== "Identifier") {
          return;
        }
        const name = node.callee.name;
        if (trackedHooks.has(name) && !node.typeArguments) {
          context.report({
            node,
            messageId: "missing",
            data: { name },
          });
        }
      },
    };
  },
});
