/**
 * Ban re-exporting React hooks that the project forbids in feature code.
 *
 * `apps/web/src/lib` may *use* effects/local state, but must not re-export
 * `useEffect` / `useState` / etc. from `"react"` — that would launder them
 * past the feature bans.
 */

const BANNED_HOOKS = new Set([
  "useEffect",
  "useLayoutEffect",
  "useState",
  "useReducer",
  "useActionState",
  "useOptimistic",
]);

const MESSAGE =
  "Do not re-export React `{{name}}`. Feature code must not import banned hooks through a local barrel.";

function exportedName(specifier) {
  return specifier.local.type === "Identifier" ? specifier.local.name : specifier.local.value;
}

const noBannedReactReexport = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow re-exporting banned React hooks from local modules",
    },
    schema: [],
    messages: {
      banned: MESSAGE,
    },
  },

  create(context) {
    return {
      ExportNamedDeclaration(node) {
        if (node.source?.value !== "react") {
          return;
        }
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ExportSpecifier") continue;
          const name = exportedName(specifier);
          if (BANNED_HOOKS.has(name)) {
            context.report({
              node: specifier,
              messageId: "banned",
              data: { name },
            });
          }
        }
      },
    };
  },
};

const plugin = {
  meta: {
    name: "no-banned-react-reexport",
  },
  rules: {
    "no-banned-react-reexport": noBannedReactReexport,
  },
};

export default plugin;
