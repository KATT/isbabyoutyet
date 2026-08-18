/**
 * Require a private helper with one direct invocation to live at that call
 * site as an IIFE. Helpers with two or more references remain valid.
 */

const GENERATED_PATH_SEGMENT = /(?:^|[/\\])(?:_generated|paraglide)(?:[/\\]|$)|[.]gen[.]/;
const REPEATED_METHODS = new Set([
  "every",
  "filter",
  "find",
  "findIndex",
  "flatMap",
  "forEach",
  "map",
  "reduce",
  "reduceRight",
  "some",
]);

function isGeneratedFile(filename) {
  return GENERATED_PATH_SEGMENT.test(filename);
}

function isFunctionValue(node) {
  return node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
}

function isExported(node) {
  return (
    node.parent?.type === "ExportDefaultDeclaration" ||
    node.parent?.type === "ExportNamedDeclaration"
  );
}

function directCallFor(identifier) {
  const call = identifier.parent;
  return call?.type === "CallExpression" && call.callee === identifier ? call : null;
}

function repeatedCallbackFor(identifier, declaration) {
  let current = identifier.parent;
  while (current) {
    if (
      (current.type === "ArrowFunctionExpression" || current.type === "FunctionExpression") &&
      current.parent?.type === "CallExpression" &&
      current.parent.arguments.includes(current) &&
      current.parent.callee.type === "MemberExpression" &&
      !current.parent.callee.computed &&
      current.parent.callee.property.type === "Identifier" &&
      REPEATED_METHODS.has(current.parent.callee.property.name)
    ) {
      const declarationIsInsideCallback =
        current.start <= declaration.start && declaration.end <= current.end;
      if (!declarationIsInsideCallback) {
        return current;
      }
    }
    current = current.parent;
  }
  return null;
}

function inlineExpression(sourceCode, declaration) {
  if (declaration.type === "VariableDeclarator") {
    return sourceCode.getText(declaration.init);
  }

  const text = sourceCode.getText(declaration);
  const relativeNameStart = declaration.id.start - declaration.start;
  const relativeNameEnd = declaration.id.end - declaration.start;
  return `${text.slice(0, relativeNameStart)}${text.slice(relativeNameEnd)}`;
}

function removableDeclaration(declaration) {
  if (declaration.type === "FunctionDeclaration") {
    return declaration;
  }

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

function hasAttachedLeadingComment(sourceCode, declaration) {
  const comments = sourceCode.getCommentsBefore(declaration);
  const comment = comments.at(-1);
  if (!comment) {
    return false;
  }
  const gap = sourceCode.text.slice(comment.end, declaration.start);
  return gap.trim() === "" && !gap.includes("\n\n");
}

const inlineSingleUseHelper = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Inline a private helper as an IIFE when it has exactly one direct invocation",
    },
    schema: [],
    hasSuggestions: true,
    messages: {
      inline:
        "`{{name}}` is invoked once. Keep the logic at its call site with an IIFE.",
      inlineSuggestion: "Inline `{{name}}` as an IIFE",
    },
  },

  create(context) {
    if (isGeneratedFile(context.physicalFilename)) {
      return {};
    }

    const sourceCode = context.sourceCode;

    function checkDeclaration(declaration) {
      if (isExported(declaration) || /^use[A-Z]/.test(declaration.id.name)) {
        return;
      }

      const variable = sourceCode
        .getDeclaredVariables(declaration)
        .find((candidate) => candidate.name === declaration.id.name);
      if (!variable) {
        return;
      }

      const references = variable.references.filter((reference) => reference.isRead());
      if (references.length !== 1) {
        return;
      }

      const reference = references[0];
      if (
        !directCallFor(reference.identifier) ||
        repeatedCallbackFor(reference.identifier, declaration)
      ) {
        return;
      }

      const removable = hasAttachedLeadingComment(sourceCode, declaration)
        ? null
        : removableDeclaration(declaration);
      const suggest = removable
        ? [
            {
              messageId: "inlineSuggestion",
              data: { name: variable.name },
              fix(fixer) {
                return [
                  fixer.replaceText(
                    reference.identifier,
                    `(${inlineExpression(sourceCode, declaration)})`,
                  ),
                  fixer.removeRange(declarationRemovalRange(sourceCode, removable)),
                ];
              },
            },
          ]
        : null;

      context.report({
        node: declaration.id,
        messageId: "inline",
        data: { name: variable.name },
        suggest,
      });
    }

    return {
      FunctionDeclaration(node) {
        if (node.id && node.body) {
          checkDeclaration(node);
        }
      },
      VariableDeclarator(node) {
        if (node.id.type === "Identifier" && isFunctionValue(node.init)) {
          checkDeclaration(node);
        }
      },
    };
  },
};

export default {
  meta: {
    name: "inline-single-use-helper",
  },
  rules: {
    "inline-single-use-helper": inlineSingleUseHelper,
  },
};
