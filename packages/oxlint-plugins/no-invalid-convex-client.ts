import { defineRule } from "@oxlint/plugins";

/**
 * Steer web tests toward convex-test harness integration instead of stub clients.
 */

const INVALID_CONVEX_URL = "https://example.invalid";

function calleeName(node) {
  if (!node) {
    return null;
  }
  if (node.type === "Identifier") {
    return node.name;
  }
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    return node.property.name;
  }
  return null;
}

function firstStringArg(node) {
  const first = node.arguments[0];
  if (first?.type === "Literal" && typeof first.value === "string") {
    return first.value;
  }
  return null;
}

export const noInvalidConvexClient = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow stub ConvexReactClient URLs in web tests; use createConvexTestHarness instead",
    },
    schema: [],
    messages: {
      banned:
        'Stub ConvexReactClient URLs are not allowed in web tests. Use createConvexTestHarness() instead of new ConvexReactClient("https://example.invalid").',
    },
  },

  create(context) {
    const convexClientNames = new Set(["ConvexReactClient"]);

    return {
      ImportDeclaration(node) {
        if (node.source.value !== "convex/react") {
          return;
        }
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier") {
            convexClientNames.add(specifier.local.name);
          }
        }
      },

      NewExpression(node) {
        const name = calleeName(node.callee);
        if (name == null || !convexClientNames.has(name)) {
          return;
        }
        const url = firstStringArg(node);
        if (url === INVALID_CONVEX_URL) {
          context.report({ node, messageId: "banned" });
        }
      },
    };
  },
});
