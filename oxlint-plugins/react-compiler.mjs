/**
 * Rules for codebases that rely on React Compiler for memoization.
 */

const MESSAGE = "React Compiler handles memoization automatically.";
const MANUAL_MEMOIZATION_HOOKS = new Set(["useCallback", "useMemo"]);

function propertyName(node) {
  if (node.type === "Identifier") {
    return node.name;
  }
  if (node.type === "Literal") {
    return node.value;
  }
  return null;
}

function reportManualMemoization(context, node) {
  context.report({ messageId: "banned", node });
}

const noManualMemoization = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow manual useCallback and useMemo calls when React Compiler is enabled",
    },
    schema: [],
    messages: {
      banned: MESSAGE,
    },
  },

  create(context) {
    return {
      ImportSpecifier(node) {
        const declaration = node.parent;
        if (
          declaration?.type === "ImportDeclaration" &&
          declaration.source.value === "react" &&
          MANUAL_MEMOIZATION_HOOKS.has(propertyName(node.imported))
        ) {
          reportManualMemoization(context, node);
        }
      },

      MemberExpression(node) {
        if (MANUAL_MEMOIZATION_HOOKS.has(propertyName(node.property))) {
          reportManualMemoization(context, node);
        }
      },

      Property(node) {
        if (
          node.parent?.type === "ObjectPattern" &&
          MANUAL_MEMOIZATION_HOOKS.has(propertyName(node.key))
        ) {
          reportManualMemoization(context, node);
        }
      },
    };
  },
};

const plugin = {
  meta: {
    name: "react-compiler",
  },
  rules: {
    "no-manual-memoization": noManualMemoization,
  },
};

export default plugin;
