/**
 * Require callback parameters to rely on their contextual types.
 *
 * This applies to callbacks passed directly to calls/JSX and to callbacks in
 * nested option objects passed to calls. Standalone function declarations and
 * uncontextualized function-valued object properties are outside the rule.
 */

const GENERATED_PATH_SEGMENT = /(?:^|[/\\])(?:_generated|paraglide)(?:[/\\]|$)|[.]gen[.]/;
const TRANSPARENT_WRAPPERS = new Set([
  "ChainExpression",
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSInstantiationExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);

function isGeneratedFile(filename) {
  return GENERATED_PATH_SEGMENT.test(filename);
}

function isCallArgument(call, candidate) {
  return call.arguments.some((argument) => argument === candidate);
}

function isContextualCallback(node) {
  let candidate = node;
  let parent = candidate.parent;

  while (parent) {
    if (TRANSPARENT_WRAPPERS.has(parent.type)) {
      candidate = parent;
      parent = candidate.parent;
      continue;
    }

    if (
      parent.type === "JSXExpressionContainer" &&
      parent.expression === candidate &&
      parent.parent?.type === "JSXAttribute"
    ) {
      return true;
    }

    if (
      (parent.type === "CallExpression" || parent.type === "NewExpression") &&
      isCallArgument(parent, candidate)
    ) {
      return true;
    }

    if (
      parent.type === "Property" &&
      parent.value === candidate &&
      parent.parent?.type === "ObjectExpression"
    ) {
      candidate = parent.parent;
      parent = candidate.parent;
      continue;
    }

    if (
      (parent.type === "ArrayExpression" || parent.type === "SpreadElement") &&
      (parent.type !== "ArrayExpression" || parent.elements.includes(candidate))
    ) {
      candidate = parent;
      parent = candidate.parent;
      continue;
    }

    return false;
  }

  return false;
}

function parameterAnnotation(param) {
  if (param.type === "AssignmentPattern") {
    return parameterAnnotation(param.left);
  }
  if (param.type === "TSParameterProperty") {
    return parameterAnnotation(param.parameter);
  }
  return param.typeAnnotation ?? null;
}

const inferCallbackParams = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow explicit callback parameter types when contextual typing is available",
    },
    schema: [],
    fixable: "code",
    messages: {
      infer: "Remove this callback parameter type and rely on contextual inference.",
    },
  },

  create(context) {
    if (isGeneratedFile(context.physicalFilename)) {
      return {};
    }

    function checkCallback(node) {
      if (!isContextualCallback(node)) {
        return;
      }

      for (const param of node.params) {
        const annotation = parameterAnnotation(param);
        if (!annotation) {
          continue;
        }
        context.report({
          node: annotation,
          messageId: "infer",
          fix(fixer) {
            return fixer.remove(annotation);
          },
        });
      }
    }

    return {
      ArrowFunctionExpression: checkCallback,
      FunctionExpression: checkCallback,
    };
  },
};

export default {
  meta: {
    name: "infer-callback-params",
  },
  rules: {
    "infer-callback-params": inferCallbackParams,
  },
};
