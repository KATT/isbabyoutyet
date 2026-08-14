/**
 * Lint rules that keep Convex data access on TanStack Query + query-prefetch.
 *
 * - no-convex-query-hooks: ban Convex's useQuery / usePaginatedQuery / useQueries
 * - require-preloaded-query-options: TanStack query hooks must read via preloaded*
 * - use-loader-preloads: every ensure* handle returned from a route loader must be used
 */

const CONVEX_BANNED_HOOKS = new Set(["useQuery", "usePaginatedQuery", "useQueries"]);

const TANSTACK_QUERY_HOOKS = new Set([
  "useQuery",
  "useSuspenseQuery",
  "useInfiniteQuery",
  "useSuspenseInfiniteQuery",
]);

const PRELOADED_OPTION_FNS = new Set([
  "preloadedQueryOptions",
  "preloadedInfiniteQueryOptions",
  "preloadedConvexQueryOptions",
]);

/** Wrapper hooks with an options-object `handle` (2nd argument). */
const PRELOADED_WRAPPER_HOOKS = new Set(["usePreloadedConvexInfiniteQuery"]);

/** Wrapper hooks where the handle is the 2nd positional argument. */
const POSITIONAL_WRAPPER_HOOKS = new Set(["usePreloadedConvexQuery"]);

const ENSURE_FNS = new Set(["ensureQueryData", "ensureInfiniteQueryData"]);

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

function specifierImportedName(node) {
  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

function importSource(node) {
  const parent = node.parent;
  if (parent?.type !== "ImportDeclaration") {
    return null;
  }
  return parent.source.value;
}

function isPreloadedOptionsCall(node) {
  return node?.type === "CallExpression" && PRELOADED_OPTION_FNS.has(calleeName(node.callee));
}

function isEnsureCall(node) {
  return node?.type === "CallExpression" && ENSURE_FNS.has(calleeName(node.callee));
}

function isAllKeyedCall(node) {
  return node?.type === "CallExpression" && calleeName(node.callee) === "allKeyed";
}

function isPromiseAllCall(node) {
  return (
    node?.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "Promise" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "all"
  );
}

function unwrapAwait(node) {
  return node?.type === "AwaitExpression" ? node.argument : node;
}

function isPreloadExpression(node, preloadBindings) {
  if (!node) {
    return false;
  }
  if (node.type === "AwaitExpression") {
    return isPreloadExpression(node.argument, preloadBindings);
  }
  if (isEnsureCall(node)) {
    return true;
  }
  if (node.type === "Identifier") {
    return preloadBindings.has(node.name);
  }
  return false;
}

function collectKeysFromExpression(expression, preloadBindings, allKeyedKeys, keys) {
  if (!expression) {
    return;
  }

  if (expression.type === "ObjectExpression") {
    for (const property of expression.properties) {
      if (property.type === "SpreadElement") {
        collectKeysFromExpression(property.argument, preloadBindings, allKeyedKeys, keys);
        continue;
      }
      if (property.type !== "Property" || property.computed || property.key.type !== "Identifier") {
        continue;
      }
      if (isPreloadExpression(property.value, preloadBindings)) {
        keys.add(property.key.name);
      }
    }
    return;
  }

  if (expression.type === "AwaitExpression") {
    collectKeysFromExpression(expression.argument, preloadBindings, allKeyedKeys, keys);
    return;
  }

  if (expression.type === "Identifier" && allKeyedKeys.has(expression.name)) {
    for (const key of allKeyedKeys.get(expression.name)) {
      keys.add(key);
    }
    return;
  }

  if (isAllKeyedCall(expression)) {
    for (const key of keysFromAllKeyedCall(expression, preloadBindings)) {
      keys.add(key);
    }
  }
}

function keysFromAllKeyedCall(expression, preloadBindings) {
  const keys = new Set();
  const dict = expression.arguments[0];
  if (dict?.type !== "ObjectExpression") {
    return keys;
  }
  for (const property of dict.properties) {
    if (
      property.type === "Property" &&
      !property.computed &&
      property.key.type === "Identifier" &&
      isPreloadExpression(property.value, preloadBindings)
    ) {
      keys.add(property.key.name);
    }
  }
  return keys;
}

function markKeyFromExpression(node, usedKeys) {
  if (!node) {
    return;
  }
  if (node.type === "Identifier") {
    usedKeys.add(node.name);
    return;
  }
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    usedKeys.add(node.property.name);
  }
}

function isLoaderFunction(node) {
  const parent = node.parent;
  return (
    parent?.type === "Property" &&
    !parent.computed &&
    parent.key.type === "Identifier" &&
    parent.key.name === "loader" &&
    parent.value === node
  );
}

const noConvexQueryHooks = {
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
};

const requirePreloadedQueryOptions = {
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

      const name = calleeName(callee);
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
        if (node.id.type === "Identifier" && node.init && isPreloadedOptionsCall(unwrap(node.init))) {
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
};

const useLoaderPreloads = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every query-prefetch handle returned from a route loader to be consumed via preloaded options or passed to a child",
    },
    schema: [],
    messages: {
      unused:
        "Loader preloads `{{key}}` but it is never passed to `preloadedQueryOptions` / `preloadedInfiniteQueryOptions` / `usePreloadedConvexInfiniteQuery` or a child prop in this file.",
    },
  },
  create(context) {
    const preloadBindings = new Set();
    /** @type {Map<string, Set<string>>} */
    const allKeyedBindings = new Map();
    /** @type {Map<string, import('estree').Node>} */
    const returnedKeys = new Map();
    const usedKeys = new Set();
    let loaderDepth = 0;

    function bindPreloadFromPattern(pattern, value) {
      if (pattern?.type === "Identifier" && isPreloadExpression(value, preloadBindings)) {
        preloadBindings.add(pattern.name);
      }
    }

    return {
      FunctionExpression(node) {
        if (isLoaderFunction(node)) {
          loaderDepth += 1;
        }
      },
      "FunctionExpression:exit"(node) {
        if (isLoaderFunction(node)) {
          loaderDepth -= 1;
        }
      },
      ArrowFunctionExpression(node) {
        if (isLoaderFunction(node)) {
          loaderDepth += 1;
        }
      },
      "ArrowFunctionExpression:exit"(node) {
        if (isLoaderFunction(node)) {
          loaderDepth -= 1;
        }
      },

      VariableDeclarator(node) {
        if (!loaderDepth) {
          return;
        }

        if (node.id.type === "Identifier" && node.init && isPreloadExpression(node.init, preloadBindings)) {
          preloadBindings.add(node.id.name);
        }

        const init = unwrapAwait(node.init);
        if (node.id.type === "Identifier" && isAllKeyedCall(init)) {
          allKeyedBindings.set(node.id.name, keysFromAllKeyedCall(init, preloadBindings));
        }

        if (node.id.type === "ArrayPattern" && isPromiseAllCall(init)) {
          const elements = init.arguments[0]?.type === "ArrayExpression" ? init.arguments[0].elements : [];
          node.id.elements.forEach((pattern, index) => {
            bindPreloadFromPattern(pattern, elements[index]);
          });
        }

        if (node.id.type === "ObjectPattern" && isAllKeyedCall(init)) {
          for (const property of node.id.properties) {
            if (
              property.type === "Property" &&
              !property.computed &&
              property.value.type === "Identifier"
            ) {
              preloadBindings.add(property.value.name);
            }
          }
        }
      },

      AssignmentExpression(node) {
        if (!loaderDepth) {
          return;
        }
        const right = unwrapAwait(node.right);
        if (node.left.type === "ArrayPattern" && isPromiseAllCall(right)) {
          const elements = right.arguments[0]?.type === "ArrayExpression" ? right.arguments[0].elements : [];
          node.left.elements.forEach((pattern, index) => {
            bindPreloadFromPattern(pattern, elements[index]);
          });
        }
      },

      ReturnStatement(node) {
        if (!loaderDepth || !node.argument) {
          return;
        }
        const keys = new Set();
        collectKeysFromExpression(node.argument, preloadBindings, allKeyedBindings, keys);
        for (const key of keys) {
          returnedKeys.set(key, node);
        }
      },

      CallExpression(node) {
        if (loaderDepth) {
          return;
        }
        const name = calleeName(node.callee);
        if (PRELOADED_OPTION_FNS.has(name) && node.arguments[1]) {
          markKeyFromExpression(node.arguments[1], usedKeys);
        }
        if (POSITIONAL_WRAPPER_HOOKS.has(name) && node.arguments[1]) {
          markKeyFromExpression(node.arguments[1], usedKeys);
        }
        if (PRELOADED_WRAPPER_HOOKS.has(name)) {
          const opts = node.arguments[1];
          if (opts?.type === "ObjectExpression") {
            for (const property of opts.properties) {
              if (
                property.type === "Property" &&
                !property.computed &&
                property.key.type === "Identifier" &&
                property.key.name === "handle"
              ) {
                markKeyFromExpression(property.value, usedKeys);
              }
            }
          }
        }
      },

      JSXAttribute(node) {
        if (loaderDepth) {
          return;
        }
        if (node.value?.type === "JSXExpressionContainer") {
          markKeyFromExpression(node.value.expression, usedKeys);
        }
      },

      Property(node) {
        if (loaderDepth) {
          return;
        }
        if (node.parent?.type !== "ObjectExpression" || node.computed) {
          return;
        }
        // Hand-off like `{ listing: loaderData.coParentsList }`
        markKeyFromExpression(node.value, usedKeys);
      },

      "Program:exit"() {
        for (const [key, node] of returnedKeys) {
          if (!usedKeys.has(key)) {
            context.report({
              node,
              messageId: "unused",
              data: { key },
            });
          }
        }
      },
    };
  },
};

const plugin = {
  meta: {
    name: "query-prefetch",
  },
  rules: {
    "no-convex-query-hooks": noConvexQueryHooks,
    "require-preloaded-query-options": requirePreloadedQueryOptions,
    "use-loader-preloads": useLoaderPreloads,
  },
};

export default plugin;
