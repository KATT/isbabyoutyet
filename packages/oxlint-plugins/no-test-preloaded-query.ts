import { defineRule } from "@oxlint/plugins";

/**
 * Disallow fake preloaded Convex query handles in web tests; seed convex-test instead.
 */

const TEST_HELPER_MODULE = "@workspace/convex-prefetch/test-helpers";

const BANNED_PRELOAD_FNS = new Set([
  "testPreloadedConvexQuery",
  "testPreloadedConvexInfiniteQuery",
]);

function specifierImportedName(node) {
  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

export const noTestPreloadedQuery = defineRule({
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
