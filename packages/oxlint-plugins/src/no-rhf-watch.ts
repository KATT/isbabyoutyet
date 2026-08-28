import { defineRule, eslintCompatPlugin } from "@oxlint/plugins";

/**
 * Disallow react-hook-form's imperative `.watch()` / `watch()`, and require
 * `useWatch({ control, name })` (never a whole-form watch without `name`).
 *
 * Named `useWatch` subscriptions re-render under the React Compiler the same
 * way `useFormState` does for submit state.
 */

const WATCH_MESSAGE =
  "Do not use react-hook-form `.watch()` / `watch()`. Use `useWatch({ control, name })` so the subscription re-renders under the React Compiler.";

const USE_WATCH_NAME_MESSAGE =
  "Pass `control` and `name` to `useWatch()` (`name` is a field path or path array). Whole-form `useWatch({ control })` without `name` is not allowed.";

function memberName(property, computed) {
  if (!computed && property.type === "Identifier") {
    return property.name;
  }
  if (computed && property.type === "Literal" && typeof property.value === "string") {
    return property.value;
  }
  return null;
}

function report(context, node, message) {
  context.report({
    node,
    message,
  });
}

/**
 * Tracks locals bound to RHF's `watch` API so `const { watch } = form` and
 * `import { watch } from "react-hook-form"` cannot slip past as bare calls.
 */
function collectWatchLocals(node, watchLocals) {
  if (node.source.type !== "Literal" || node.source.value !== "react-hook-form") {
    return;
  }
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

/** Local names bound to `useWatch` from `react-hook-form`. */
function collectUseWatchLocals(node, useWatchLocals) {
  if (node.source.type !== "Literal" || node.source.value !== "react-hook-form") {
    return;
  }
  for (const specifier of node.specifiers) {
    if (
      specifier.type === "ImportSpecifier" &&
      specifier.imported.type === "Identifier" &&
      specifier.imported.name === "useWatch"
    ) {
      useWatchLocals.add(specifier.local.name);
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
    report(context, property, WATCH_MESSAGE);
    if (property.value.type === "Identifier") {
      watchLocals.add(property.value.name);
    }
  }
}

function objectHasNameKey(objectExpression) {
  for (const property of objectExpression.properties) {
    if (property.type !== "Property") {
      continue;
    }
    if (memberName(property.key, property.computed) === "name") {
      return true;
    }
  }
  return false;
}

function checkUseWatchCall(context, node, useWatchLocals) {
  if (node.callee.type !== "Identifier" || !useWatchLocals.has(node.callee.name)) {
    return;
  }
  const firstArg = node.arguments[0];
  if (firstArg == null || firstArg.type !== "ObjectExpression" || !objectHasNameKey(firstArg)) {
    report(context, node, USE_WATCH_NAME_MESSAGE);
  }
}

function checkWatchCall(context, node, watchLocals) {
  if (node.callee.type === "Identifier") {
    if (watchLocals.has(node.callee.name)) {
      report(context, node, WATCH_MESSAGE);
    }
    return;
  }
  if (node.callee.type !== "MemberExpression") {
    return;
  }
  const name = memberName(node.callee.property, node.callee.computed);
  if (name === "watch") {
    report(context, node, WATCH_MESSAGE);
  }
}

const noRhfWatch = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow react-hook-form `.watch()` / `watch()` and require `useWatch({ control, name })`",
    },
    schema: [],
  },

  create(context) {
    const watchLocals = new Set();
    const useWatchLocals = new Set(["useWatch"]);
    return {
      ImportDeclaration(node) {
        collectWatchLocals(node, watchLocals);
        collectUseWatchLocals(node, useWatchLocals);
      },
      VariableDeclarator(node) {
        checkDestructuredWatch(context, node, watchLocals);
      },
      CallExpression(node) {
        checkWatchCall(context, node, watchLocals);
        checkUseWatchCall(context, node, useWatchLocals);
      },
    };
  },
});

const plugin = eslintCompatPlugin({
  meta: {
    name: "no-rhf-watch",
  },
  rules: {
    "no-rhf-watch": noRhfWatch,
  },
});

export default plugin;
