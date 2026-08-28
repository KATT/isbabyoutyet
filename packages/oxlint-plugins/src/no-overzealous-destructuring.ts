import { defineRule, eslintCompatPlugin } from "@oxlint/plugins";

/**
 * Prevent object destructuring that creates a local used fewer than three
 * times. Rest/spread destructuring and JSX component aliases stay valid.
 */

const GENERATED_PATH_SEGMENT = /(?:^|[/\\])(?:_generated|paraglide)(?:[/\\]|$)|[.]gen[.]/;
const MINIMUM_DESTRUCTURED_READS = 3;

function isGeneratedFile(filename) {
  return GENERATED_PATH_SEGMENT.test(filename);
}

function isFunction(node) {
  return (
    node?.type === "ArrowFunctionExpression" ||
    node?.type === "FunctionDeclaration" ||
    node?.type === "FunctionExpression"
  );
}

function containingFunction(node) {
  let current = node.parent;
  while (current && !isFunction(current)) {
    current = current.parent;
  }
  return current;
}

function identifierParams(node) {
  const fn = containingFunction(node);
  if (!fn) {
    return new Set();
  }
  return new Set(
    fn.params.filter((param) => param.type === "Identifier").map((param) => param.name),
  );
}

function bindingForProperty(property) {
  if (property.type !== "Property" || property.computed || property.key.type !== "Identifier") {
    return null;
  }
  if (property.value.type === "Identifier") {
    return {
      name: property.value.name,
      node: property.value,
      sourceName: property.key.name,
    };
  }
  if (property.value.type === "AssignmentPattern" && property.value.left.type === "Identifier") {
    return {
      name: property.value.left.name,
      node: property.value.left,
      sourceName: property.key.name,
    };
  }
  return null;
}

function declaredVariable(sourceCode, declaration, name) {
  return sourceCode.getDeclaredVariables(declaration).find((candidate) => candidate.name === name);
}

function readReferences(sourceCode, declaration, name) {
  return (
    declaredVariable(sourceCode, declaration, name)?.references.filter((reference) =>
      reference.isRead(),
    ) ?? []
  );
}

function isSpreadReference(reference) {
  return (
    reference.identifier.parent?.type === "SpreadElement" ||
    reference.identifier.parent?.type === "JSXSpreadAttribute"
  );
}

function isJsxTagReference(reference) {
  return (
    reference.identifier.parent?.type === "JSXOpeningElement" ||
    reference.identifier.parent?.type === "JSXClosingElement"
  );
}

function patternUsesRest(pattern) {
  return pattern.properties.some((property) => property.type === "RestElement");
}

function removableDeclaration(declaration) {
  const variableDeclaration = declaration.parent;
  if (
    variableDeclaration?.type === "VariableDeclaration" &&
    variableDeclaration.declarations.length === 1
  ) {
    return variableDeclaration;
  }
  return null;
}

function declarationRemovalRange(sourceCode, declaration) {
  const lineStart = sourceCode.text.lastIndexOf("\n", declaration.start - 1) + 1;
  const nextLineBreak = sourceCode.text.indexOf("\n", declaration.end);
  const lineEnd = nextLineBreak === -1 ? sourceCode.text.length : nextLineBreak + 1;
  const onlyIndentBefore = sourceCode.text.slice(lineStart, declaration.start).trim() === "";
  const onlyWhitespaceAfter = sourceCode.text.slice(declaration.end, lineEnd).trim() === "";
  return [
    onlyIndentBefore ? lineStart : declaration.start,
    onlyWhitespaceAfter ? lineEnd : declaration.end,
  ];
}

function replacementFix(fixer, reference, name, replacement) {
  const parent = reference.identifier.parent;
  if (
    parent?.type === "Property" &&
    parent.shorthand &&
    parent.parent?.type === "ObjectExpression"
  ) {
    return fixer.replaceText(parent, `${name}: ${replacement}`);
  }
  return fixer.replaceText(reference.identifier, replacement);
}

function directAccessSuggestion(opts) {
  const declarationFunction = containingFunction(opts.declaration);
  if (
    opts.allowSuggestion === false ||
    opts.references.some(
      (reference) => containingFunction(reference.identifier) !== declarationFunction,
    )
  ) {
    return null;
  }
  const removable = removableDeclaration(opts.declaration);
  if (!removable) {
    return null;
  }
  return [
    {
      messageId: "directSuggestion",
      data: { name: opts.name },
      fix(fixer) {
        return [
          ...opts.references.map((reference) =>
            replacementFix(fixer, reference, opts.name, opts.replacement),
          ),
          fixer.removeRange(declarationRemovalRange(opts.sourceCode, removable)),
        ];
      },
    },
  ];
}

const noOverzealousDestructuring = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow destructuring a field used fewer than three times",
    },
    schema: [],
    hasSuggestions: true,
    messages: {
      body: "`{{name}}` is read {{count}} time(s). Use `{{member}}` directly until destructuring removes at least three repeated accesses.",
      parameter:
        "`{{name}}` is read {{count}} time(s). Accept an object parameter and access this field directly until it has at least three reads.",
      directSuggestion: "Replace `{{name}}` with direct member access",
    },
  },

  create(context) {
    if (isGeneratedFile(context.physicalFilename)) {
      return {};
    }

    const sourceCode = context.sourceCode;

    function shouldAllow(references) {
      return (
        references.length >= MINIMUM_DESTRUCTURED_READS ||
        references.some(isSpreadReference) ||
        references.some(isJsxTagReference)
      );
    }

    function checkParameterPattern(fn, pattern) {
      if (pattern.type !== "ObjectPattern" || patternUsesRest(pattern)) {
        return;
      }
      for (const property of pattern.properties) {
        const binding = bindingForProperty(property);
        if (!binding) {
          continue;
        }
        const references =
          declaredVariable(sourceCode, fn, binding.name)?.references.filter((reference) =>
            reference.isRead(),
          ) ?? [];
        if (shouldAllow(references)) {
          continue;
        }
        context.report({
          node: binding.node,
          messageId: "parameter",
          data: { name: binding.name, count: references.length },
        });
      }
    }

    function checkFunction(fn) {
      for (const param of fn.params) {
        checkParameterPattern(fn, param);
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,

      VariableDeclarator(node) {
        if (
          node.parent?.type !== "VariableDeclaration" ||
          node.parent.kind !== "const" ||
          node.id.type !== "ObjectPattern" ||
          patternUsesRest(node.id) ||
          node.init?.type !== "Identifier" ||
          !identifierParams(node).has(node.init.name)
        ) {
          return;
        }

        for (const property of node.id.properties) {
          const binding = bindingForProperty(property);
          if (!binding) {
            continue;
          }
          const references = readReferences(sourceCode, node, binding.name);
          if (shouldAllow(references)) {
            continue;
          }
          const replacement = `${node.init.name}.${binding.sourceName}`;
          context.report({
            node: binding.node,
            messageId: "body",
            data: {
              name: binding.name,
              count: references.length,
              member: replacement,
            },
            suggest: directAccessSuggestion({
              allowSuggestion: node.id.properties.length === 1,
              declaration: node,
              name: binding.name,
              references,
              replacement,
              sourceCode,
            }),
          });
        }
      },
    };
  },
});

export default eslintCompatPlugin({
  meta: {
    name: "no-overzealous-destructuring",
  },
  rules: {
    "no-overzealous-destructuring": noOverzealousDestructuring,
  },
});
