import { defineRule } from "@oxlint/plugins";
import {
  calleeName,
  collectKeysFromExpression,
  isAllKeyedCall,
  isLoaderFunction,
  isPreloadExpression,
  isPromiseAllCall,
  keysFromAllKeyedCall,
  markKeyFromExpression,
  PRELOADED_OPTION_FNS,
  PRELOADED_WRAPPER_HOOKS,
  POSITIONAL_WRAPPER_HOOKS,
  unwrapAwait,
} from "./query-prefetch-shared.ts";

export const useLoaderPreloads = defineRule({
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
    /** @type {Map<string, { type: string }>} */
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

        if (
          node.id.type === "Identifier" &&
          node.init &&
          isPreloadExpression(node.init, preloadBindings)
        ) {
          preloadBindings.add(node.id.name);
        }

        const init = unwrapAwait(node.init);
        if (node.id.type === "Identifier" && isAllKeyedCall(init)) {
          allKeyedBindings.set(node.id.name, keysFromAllKeyedCall(init, preloadBindings));
        }

        if (node.id.type === "ArrayPattern" && isPromiseAllCall(init)) {
          const elements =
            init.arguments[0]?.type === "ArrayExpression" ? init.arguments[0].elements : [];
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
          const elements =
            right.arguments[0]?.type === "ArrayExpression" ? right.arguments[0].elements : [];
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
});
