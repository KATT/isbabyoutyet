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

function checkMemberCall(context, node) {
  if (node.callee.type !== "MemberExpression") {
    return;
  }
  const object = node.callee.object;
  const property = node.callee.property;
  if (object.type !== "Identifier") {
    return;
  }
  if (!isVitestOrJestIdentifier(object.name)) {
    return;
  }
  const name = memberName(property, node.callee.computed);
  if (name == null || !BANNED.has(name)) {
    return;
  }
  reportMockCall(context, node, `${object.name}.${name}`);
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
