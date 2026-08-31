import { defineRule } from "@oxlint/plugins";
import {
  CONVEX_BANNED_HOOKS,
  importSource,
  isPreloadedOptionsCall,
  specifierImportedName,
  TANSTACK_QUERY_HOOKS,
} from "./query-prefetch-shared.ts";

export const requirePreloadedQueryOptions = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require TanStack query hooks to read Convex data via preloadedQueryOptions / preloadedInfiniteQueryOptions",
    },
    schema: [],
    messages: {
      requirePreloaded:
        "`{{name}}` must receive `preloadedQueryOptions(...)` or `preloadedInfiniteQueryOptions(...)` (or use `usePreloadedConvexQuery` / `usePreloadedConvexInfiniteQuery`). Ad-hoc `{ queryKey, queryFn }` objects are allowed for non-Convex queries.",
    },
  },
  create(context) {
    const preloadedBindings = new Set();
    /** Local names imported from `convex/react` that are banned Convex query hooks. */
    const convexHookLocals = new Set();
    /** @type {Map<string, string>} local name → imported name from `@tanstack/react-query` */
    const tanstackHookLocals = new Map();

    function unwrap(node) {
      if (!node) {
        return node;
      }
      if (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") {
        return unwrap(node.expression);
      }
      return node;
    }

    function isAllowedOptions(node) {
      const inner = unwrap(node);
      if (!inner) {
        return false;
      }
      if (isPreloadedOptionsCall(inner)) {
        return true;
      }
      if (inner.type === "Identifier" && preloadedBindings.has(inner.name)) {
        return true;
      }
      return false;
    }

    function resolveTanstackHook(callee) {
      if (callee?.type === "Identifier") {
        if (convexHookLocals.has(callee.name)) {
          return null;
        }
        const importedFromTanstack = tanstackHookLocals.get(callee.name);
        if (importedFromTanstack) {
          return { reportName: callee.name, importedName: importedFromTanstack };
        }
        if (TANSTACK_QUERY_HOOKS.has(callee.name)) {
          return { reportName: callee.name, importedName: callee.name };
        }
        return null;
      }

      const name =
        callee?.type === "Identifier"
          ? callee.name
          : callee?.type === "MemberExpression" &&
              !callee.computed &&
              callee.property.type === "Identifier"
            ? callee.property.name
            : null;
      if (!name || !TANSTACK_QUERY_HOOKS.has(name)) {
        return null;
      }
      return { reportName: name, importedName: name };
    }

    return {
      ImportSpecifier(node) {
        const imported = specifierImportedName(node);
        const source = importSource(node);
        if (source === "convex/react" && CONVEX_BANNED_HOOKS.has(imported)) {
          convexHookLocals.add(node.local.name);
          return;
        }
        if (source === "@tanstack/react-query" && TANSTACK_QUERY_HOOKS.has(imported)) {
          tanstackHookLocals.set(node.local.name, imported);
        }
      },
      VariableDeclarator(node) {
        if (
          node.id.type === "Identifier" &&
          node.init &&
          isPreloadedOptionsCall(unwrap(node.init))
        ) {
          preloadedBindings.add(node.id.name);
        }
      },
      CallExpression(node) {
        const hook = resolveTanstackHook(node.callee);
        if (!hook) {
          return;
        }

        const firstArg = node.arguments[0];
        if (!firstArg) {
          context.report({ node, messageId: "requirePreloaded", data: { name: hook.reportName } });
          return;
        }

        // Ad-hoc client queries: useQuery({ queryKey, queryFn })
        if (hook.importedName === "useQuery" && unwrap(firstArg).type === "ObjectExpression") {
          return;
        }

        if (isAllowedOptions(firstArg)) {
          return;
        }

        context.report({ node, messageId: "requirePreloaded", data: { name: hook.reportName } });
      },
    };
  },
});
