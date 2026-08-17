/**
 * Disallow React's `useEffect` outside the vendored UI package.
 *
 * App state should come from route search params, queries, mutations, or
 * direct user interactions. External subscriptions belong behind
 * `useSyncExternalStore` instead of effect-driven synchronization.
 */

const MESSAGE =
  "Do not use React `useEffect`. Derive state during render, update it in user interactions, or subscribe with `useSyncExternalStore`.";

function importedName(node) {
  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

function propertyName(node) {
  if (node.property.type === "Identifier" && !node.computed) {
    return node.property.name;
  }
  if (node.property.type === "Literal") {
    return node.property.value;
  }
  return null;
}

const noUseEffect = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow React useEffect",
    },
    schema: [],
    messages: {
      banned: MESSAGE,
    },
  },

  create(context) {
    const reactNamespaces = new Set();

    return {
      ImportSpecifier(node) {
        if (
          node.parent?.type === "ImportDeclaration" &&
          node.parent.source.value === "react" &&
          importedName(node) === "useEffect"
        ) {
          context.report({ node, messageId: "banned" });
        }
      },

      ImportDefaultSpecifier(node) {
        if (node.parent?.type === "ImportDeclaration" && node.parent.source.value === "react") {
          reactNamespaces.add(node.local.name);
        }
      },

      ImportNamespaceSpecifier(node) {
        if (node.parent?.type === "ImportDeclaration" && node.parent.source.value === "react") {
          reactNamespaces.add(node.local.name);
        }
      },

      MemberExpression(node) {
        if (
          node.object.type === "Identifier" &&
          reactNamespaces.has(node.object.name) &&
          propertyName(node) === "useEffect"
        ) {
          context.report({ node, messageId: "banned" });
        }
      },

      VariableDeclarator(node) {
        if (
          node.id.type !== "ObjectPattern" ||
          node.init?.type !== "Identifier" ||
          !reactNamespaces.has(node.init.name)
        ) {
          return;
        }
        for (const property of node.id.properties) {
          if (
            property.type === "Property" &&
            !property.computed &&
            property.key.type === "Identifier" &&
            property.key.name === "useEffect"
          ) {
            context.report({ node: property, messageId: "banned" });
          }
        }
      },

      ExportNamedDeclaration(node) {
        if (node.source?.value !== "react") {
          return;
        }
        for (const specifier of node.specifiers) {
          if (
            specifier.type === "ExportSpecifier" &&
            (specifier.local.type === "Identifier"
              ? specifier.local.name
              : specifier.local.value) === "useEffect"
          ) {
            context.report({ node: specifier, messageId: "banned" });
          }
        }
      },
    };
  },
};

const plugin = {
  meta: {
    name: "no-use-effect",
  },
  rules: {
    "no-use-effect": noUseEffect,
  },
};

export default plugin;
