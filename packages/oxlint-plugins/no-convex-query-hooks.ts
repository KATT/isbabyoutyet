import { defineRule } from "@oxlint/plugins";
import {
  CONVEX_BANNED_HOOKS,
  importSource,
  specifierImportedName,
} from "./query-prefetch-shared.ts";

export const noConvexQueryHooks = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Convex react query hooks; use TanStack Query + ConvexQueryClient instead",
    },
    schema: [],
    messages: {
      banned:
        "Do not use `{{name}}` from `convex/react`. Use `usePreloadedConvexQuery` for Convex data, or TanStack Query (`useQuery` / `useSuspenseQuery`) with `preloadedQueryOptions`.",
    },
  },
  create(context) {
    /** @type {Map<string, string>} local name → imported name */
    const convexHookLocals = new Map();

    return {
      ImportSpecifier(node) {
        const imported = specifierImportedName(node);
        if (!CONVEX_BANNED_HOOKS.has(imported) || importSource(node) !== "convex/react") {
          return;
        }
        convexHookLocals.set(node.local.name, imported);
        context.report({
          node,
          messageId: "banned",
          data: { name: imported },
        });
      },
      CallExpression(node) {
        if (node.callee.type !== "Identifier") {
          return;
        }
        const imported = convexHookLocals.get(node.callee.name);
        if (!imported) {
          return;
        }
        context.report({
          node,
          messageId: "banned",
          data: { name: imported },
        });
      },
    };
  },
});
