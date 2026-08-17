/**
 * Rules for codebases that rely on React Compiler for memoization.
 */

const MESSAGE = "React Compiler handles memoization automatically.";

function propertyName(node) {
  if (node.type === "Identifier") {
    return node.name;
  }
  if (node.type === "Literal") {
    return node.value;
  }
  return null;
}

function reportUseMemo(context, node) {
  context.report({ messageId: "banned", node });
}

const noUseMemo = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow manual useMemo calls when React Compiler is enabled",
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
          propertyName(node.imported) === "useMemo"
        ) {
          reportUseMemo(context, node);
        }
      },

      MemberExpression(node) {
        if (propertyName(node.property) === "useMemo") {
          reportUseMemo(context, node);
        }
      },

      Property(node) {
        if (node.parent?.type === "ObjectPattern" && propertyName(node.key) === "useMemo") {
          reportUseMemo(context, node);
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
    "no-use-memo": noUseMemo,
  },
};

export default plugin;
