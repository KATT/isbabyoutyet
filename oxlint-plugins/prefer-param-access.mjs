/**
 * Keep options/props access explicit until a field is read at least three
 * times. Object parameter destructuring is also rejected unless destructuring
 * is required for a rest/spread operation.
 */

const GENERATED_PATH_SEGMENT = /(?:^|[/\\])(?:_generated|paraglide)(?:[/\\]|$)|[.]gen[.]/;
const MINIMUM_ALIAS_READS = 3;

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

function directParamMember(node) {
  if (
    node?.type !== "MemberExpression" ||
    node.computed ||
    node.object.type !== "Identifier" ||
    node.property.type !== "Identifier"
  ) {
    return null;
  }
  return identifierParams(node).has(node.object.name) ? node : null;
}

function readReferences(sourceCode, declaration, name) {
  const variable = sourceCode
    .getDeclaredVariables(declaration)
    .find((candidate) => candidate.name === name);
  return variable?.references.filter((reference) => reference.isRead()) ?? [];
}

function isJsxTagReference(reference) {
  return (
    reference.identifier.parent?.type === "JSXOpeningElement" ||
    reference.identifier.parent?.type === "JSXClosingElement"
  );
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
  if (parent?.type === "Property" && parent.shorthand && parent.parent?.type === "ObjectExpression") {
    return fixer.replaceText(parent, `${name}: ${replacement}`);
  }
  return fixer.replaceText(reference.identifier, replacement);
}

function inlineSuggestion(opts) {
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
      messageId: "inlineSuggestion",
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

function patternBindings(pattern) {
  return pattern.properties.flatMap((property) => {
    if (property.type === "RestElement") {
      return property.argument.type === "Identifier" ? [property.argument.name] : [];
    }
    if (property.value.type === "Identifier") {
      return [property.value.name];
    }
    if (
      property.value.type === "AssignmentPattern" &&
      property.value.left.type === "Identifier"
    ) {
      return [property.value.left.name];
    }
    return [];
  });
}

function destructuringSupportsSpread(sourceCode, fn, pattern) {
  if (pattern.properties.some((property) => property.type === "RestElement")) {
    return true;
  }
  const names = new Set(patternBindings(pattern));
  return sourceCode.getDeclaredVariables(fn).some(
    (variable) =>
      names.has(variable.name) &&
      variable.references.some(
        (reference) =>
          reference.isRead() &&
          (reference.identifier.parent?.type === "SpreadElement" ||
            reference.identifier.parent?.type === "JSXSpreadAttribute"),
      ),
  );
}

const preferParamAccess = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer direct options/props access until a field is read at least three times",
    },
    schema: [],
    hasSuggestions: true,
    messages: {
      direct:
        "`{{name}}` is read {{count}} time(s). Use `{{member}}` directly until the alias has at least three reads.",
      parameter:
        "Do not destructure object parameters. Accept an options/props object and access its fields directly.",
      inlineSuggestion: "Replace `{{name}}` with the parameter member",
    },
  },

  create(context) {
    if (isGeneratedFile(context.physicalFilename)) {
      return {};
    }

    const sourceCode = context.sourceCode;

    function reportAlias(opts) {
      if (
        opts.name.startsWith("_") ||
        opts.references.length >= MINIMUM_ALIAS_READS ||
        opts.references.some(isJsxTagReference)
      ) {
        return;
      }
      context.report({
        node: opts.node,
        messageId: "direct",
        data: {
          name: opts.name,
          count: opts.references.length,
          member: opts.replacement,
        },
        suggest: inlineSuggestion({
          ...opts,
          sourceCode,
        }),
      });
    }

    function checkParamPattern(fn, param) {
      if (param.type !== "ObjectPattern" || destructuringSupportsSpread(sourceCode, fn, param)) {
        return;
      }
      context.report({ node: param, messageId: "parameter" });
    }

    function checkFunction(fn) {
      for (const param of fn.params) {
        checkParamPattern(fn, param);
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,

      VariableDeclarator(node) {
        if (node.parent?.type !== "VariableDeclaration" || node.parent.kind !== "const") {
          return;
        }

        if (node.id.type === "Identifier") {
          const member = directParamMember(node.init);
          if (!member) {
            return;
          }
          reportAlias({
            declaration: node,
            name: node.id.name,
            node: node.id,
            references: readReferences(sourceCode, node, node.id.name),
            replacement: sourceCode.getText(member),
          });
          return;
        }

        if (
          node.id.type !== "ObjectPattern" ||
          node.id.properties.some((property) => property.type === "RestElement")
        ) {
          return;
        }
        if (!identifierParams(node).has(node.init?.type === "Identifier" ? node.init.name : "")) {
          return;
        }

        for (const property of node.id.properties) {
          if (
            property.type !== "Property" ||
            property.computed ||
            property.key.type !== "Identifier" ||
            property.value.type !== "Identifier"
          ) {
            continue;
          }
          const name = property.value.name;
          reportAlias({
            allowSuggestion: node.id.properties.length === 1,
            declaration: node,
            name,
            node: property.value,
            references: readReferences(sourceCode, node, name),
            replacement: `${sourceCode.getText(node.init)}.${property.key.name}`,
          });
        }
      },
    };
  },
};

export default {
  meta: {
    name: "prefer-param-access",
  },
  rules: {
    "prefer-param-access": preferParamAccess,
  },
};
