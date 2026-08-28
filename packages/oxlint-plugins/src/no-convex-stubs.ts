import { defineRule, eslintCompatPlugin } from "@oxlint/plugins";

/**
 * Steer web tests toward convex-test harness integration instead of stub clients
 * and fake preloaded query handles.
 *
 * - no-invalid-convex-client: ban `new ConvexReactClient("https://example.invalid")`
 * - no-test-preloaded-query: ban `@workspace/convex-prefetch/test-helpers` imports/calls
 */

const INVALID_CONVEX_URL = "https://example.invalid";

const TEST_HELPER_MODULE = "@workspace/convex-prefetch/test-helpers";

const BANNED_PRELOAD_FNS = new Set([
  "testPreloadedConvexQuery",
  "testPreloadedConvexInfiniteQuery",
]);

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

function importSource(node) {
  const parent = node.parent;
  if (parent?.type !== "ImportDeclaration") {
    return null;
  }
  return parent.source.value;
}

function specifierImportedName(node) {
  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

const noInvalidConvexClient = defineRule({
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

const noTestPreloadedQuery = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow fake preloaded Convex query handles in web tests; seed convex-test instead",
    },
    schema: [],
    messages: {
      importBanned:
        "testPreloadedConvexQuery helpers are not allowed in web tests. Seed createConvexTestHarness() and use real preloaded handles from runRouteLoader / renderMountedFileRoute.",
      callBanned:
        "testPreloadedConvexQuery() is not allowed in web tests. Seed createConvexTestHarness() instead of hand-built preloaded handles.",
    },
  },

  create(context) {
    const bannedLocals = new Set();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== TEST_HELPER_MODULE) {
          return;
        }
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier") {
            const imported = specifierImportedName(specifier);
            if (BANNED_PRELOAD_FNS.has(imported)) {
              bannedLocals.add(specifier.local.name);
              context.report({ node: specifier, messageId: "importBanned" });
            }
          }
        }
      },

      CallExpression(node) {
        if (node.callee.type === "Identifier" && bannedLocals.has(node.callee.name)) {
          context.report({ node, messageId: "callBanned" });
        }
      },
    };
  },
});

const plugin = eslintCompatPlugin({
  meta: {
    name: "no-convex-stubs",
  },
  rules: {
    "no-invalid-convex-client": noInvalidConvexClient,
    "no-test-preloaded-query": noTestPreloadedQuery,
  },
});

export default plugin;
