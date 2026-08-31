/**
 * Shared helpers for query-prefetch lint rules (Convex + TanStack Query integration).
 */

export const CONVEX_BANNED_HOOKS = new Set(["useQuery", "usePaginatedQuery", "useQueries"]);

export const TANSTACK_QUERY_HOOKS = new Set([
  "useQuery",
  "useSuspenseQuery",
  "useInfiniteQuery",
  "useSuspenseInfiniteQuery",
]);

export const PRELOADED_OPTION_FNS = new Set([
  "preloadedQueryOptions",
  "preloadedInfiniteQueryOptions",
  "preloadedConvexQueryOptions",
]);

/** Wrapper hooks with an options-object `handle` (2nd argument). */
export const PRELOADED_WRAPPER_HOOKS = new Set(["usePreloadedConvexInfiniteQuery"]);

/** Wrapper hooks where the handle is the 2nd positional argument. */
export const POSITIONAL_WRAPPER_HOOKS = new Set(["usePreloadedConvexQuery"]);

export const ENSURE_FNS = new Set(["ensureQueryData", "ensureInfiniteQueryData"]);

export function calleeName(node) {
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

export function specifierImportedName(node) {
  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

export function importSource(node) {
  const parent = node.parent;
  if (parent?.type !== "ImportDeclaration") {
    return null;
  }
  return parent.source.value;
}

export function isPreloadedOptionsCall(node) {
  return node?.type === "CallExpression" && PRELOADED_OPTION_FNS.has(calleeName(node.callee));
}

export function isEnsureCall(node) {
  return node?.type === "CallExpression" && ENSURE_FNS.has(calleeName(node.callee));
}

export function isAllKeyedCall(node) {
  return node?.type === "CallExpression" && calleeName(node.callee) === "allKeyed";
}

export function isPromiseAllCall(node) {
  return (
    node?.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "Promise" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "all"
  );
}

export function unwrapAwait(node) {
  return node?.type === "AwaitExpression" ? node.argument : node;
}

export function isPreloadExpression(node, preloadBindings) {
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

export function collectKeysFromExpression(expression, preloadBindings, allKeyedKeys, keys) {
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

export function keysFromAllKeyedCall(expression, preloadBindings) {
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

export function markKeyFromExpression(node, usedKeys) {
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

export function isLoaderFunction(node) {
  const parent = node.parent;
  return (
    parent?.type === "Property" &&
    !parent.computed &&
    parent.key.type === "Identifier" &&
    parent.key.name === "loader" &&
    parent.value === node
  );
}
