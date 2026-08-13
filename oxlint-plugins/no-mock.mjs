/**
 * Disallow Vitest/Jest module mocking (`vi.mock`, `vi.hoisted`, …).
 *
 * Prefer real providers, convex-test seeding, and prop injection over
 * replacing modules. Local `vi.fn()` / `vi.spyOn()` for callbacks and
 * browser APIs remain allowed.
 */

const BANNED = new Set([
  "mock",
  "doMock",
  "unmock",
  "doUnmock",
  "hoisted",
  "importMock",
  "unstable_mockModule",
]);

const MESSAGE =
  "Module mocking is not allowed. Prefer convex-test, real providers, or prop injection instead of vi.mock / vi.hoisted.";

function isVitestOrJestIdentifier(name) {
  return name === "vi" || name === "jest";
}

function reportMockCall(context, node, methodName) {
  context.report({
    node,
    message: `${MESSAGE} (banned: ${methodName})`,
  });
}

function checkMemberCall(context, node) {
  if (node.callee.type !== "MemberExpression" || node.callee.computed) {
    return;
  }
  const object = node.callee.object;
  const property = node.callee.property;
  if (object.type !== "Identifier" || property.type !== "Identifier") {
    return;
  }
  if (!isVitestOrJestIdentifier(object.name)) {
    return;
  }
  if (!BANNED.has(property.name)) {
    return;
  }
  reportMockCall(context, node, `${object.name}.${property.name}`);
}

const noMock = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Vitest/Jest module mocking in favor of real test infrastructure",
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        checkMemberCall(context, node);
      },
    };
  },
};

const plugin = {
  meta: {
    name: "no-mock",
  },
  rules: {
    "no-mock": noMock,
  },
};

export default plugin;
