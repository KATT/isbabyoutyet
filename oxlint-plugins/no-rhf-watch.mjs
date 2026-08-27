/**
 * Disallow react-hook-form's imperative `.watch()` (and bare `watch()`).
 *
 * Prefer `useWatch()` so subscriptions re-render under the React Compiler
 * the same way `useFormState` does for submit state.
 */

const MESSAGE =
  "Do not use react-hook-form `.watch()` / `watch()`. Use `useWatch()` so the subscription re-renders under the React Compiler.";

function memberName(property, computed) {
  if (!computed && property.type === "Identifier") {
    return property.name;
  }
  if (
    computed &&
    property.type === "Literal" &&
    typeof property.value === "string"
  ) {
    return property.value;
  }
  return null;
}

function report(context, node) {
  context.report({
    node,
    message: MESSAGE,
  });
}

/**
 * Tracks locals bound to RHF's `watch` API so `const { watch } = form` and
 * `import { watch } from "react-hook-form"` cannot slip past as bare calls.
 */
function collectWatchLocals(node, watchLocals) {
  if (node.source.type === "Literal" && node.source.value === "react-hook-form") {
    for (const specifier of node.specifiers) {
      if (
        specifier.type === "ImportSpecifier" &&
        specifier.imported.type === "Identifier" &&
        specifier.imported.name === "watch"
      ) {
        watchLocals.add(specifier.local.name);
      }
    }
  }
}

function checkDestructuredWatch(context, node, watchLocals) {
  if (node.id.type !== "ObjectPattern") {
    return;
  }
  for (const property of node.id.properties) {
    if (property.type !== "Property") {
      continue;
    }
    const name = memberName(property.key, property.computed);
    if (name !== "watch") {
      continue;
    }
    report(context, property);
    if (property.value.type === "Identifier") {
      watchLocals.add(property.value.name);
    }
  }
}

function checkWatchCall(context, node, watchLocals) {
  if (node.callee.type === "Identifier") {
    if (watchLocals.has(node.callee.name)) {
      report(context, node);
    }
    return;
  }
  if (node.callee.type !== "MemberExpression") {
    return;
  }
  const name = memberName(node.callee.property, node.callee.computed);
  if (name === "watch") {
    report(context, node);
  }
}

const noRhfWatch = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow react-hook-form `.watch()` / `watch()` in favor of `useWatch()`",
    },
    schema: [],
  },

  create(context) {
    const watchLocals = new Set();
    return {
      ImportDeclaration(node) {
        collectWatchLocals(node, watchLocals);
      },
      VariableDeclarator(node) {
        checkDestructuredWatch(context, node, watchLocals);
      },
      CallExpression(node) {
        checkWatchCall(context, node, watchLocals);
      },
    };
  },
};

const plugin = {
  meta: {
    name: "no-rhf-watch",
  },
  rules: {
    "no-rhf-watch": noRhfWatch,
  },
};

export default plugin;
