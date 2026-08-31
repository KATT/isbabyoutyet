/**
 * Disallow undocumented Convex `v.optional()` validators.
 *
 * Optional schema fields and RPC args are a migration transient only. Prefer a
 * required validator (`v.union(..., v.null())` or a concrete value) so callers
 * and rows must set the key. Keep `v.optional()` only while backfilling, and
 * mark it with JSDoc `@todo` (still in use; remaining work to require the key)
 * or `@deprecated`.
 *
 * `convex.config.ts` env validators are excluded — those are process env, not
 * schema/RPC. Sparse `ctx.db.patch` RPC args (currently `baby.update`) keep
 * `v.optional()` with an `oxlint-disable` for that mutation.
 */

import { defineRule } from "@oxlint/plugins";

const MESSAGE =
  "`v.optional()` is only allowed as a migration transient. Add a JSDoc `@todo` (or `@deprecated`) explaining the follow-up, or use a required validator (`v.union(..., v.null())` or a concrete value).";

const DOCUMENTED_TAG = /@(?:todo|deprecated)\b/i;
const CONFIG_FILE = /(?:^|[/\\])convex\.config\.[cm]?[jt]sx?$/;
const CONVEX_VALUES = "convex/values";

function memberName(property, computed) {
  if (!computed && property.type === "Identifier") {
    return property.name;
  }
  if (computed && property.type === "Literal" && typeof property.value === "string") {
    return property.value;
  }
  return null;
}

function importedName(node) {
  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

function sourceText(context) {
  const sourceCode = context.sourceCode;
  if (typeof sourceCode.getText === "function") {
    return sourceCode.getText();
  }
  return sourceCode.text;
}

function nodeStart(node) {
  return node.range?.[0] ?? node.start;
}

/**
 * True when a `/**` JSDoc block containing `@todo` or `@deprecated` sits
 * immediately before `index` (whitespace only in between).
 */
function hasDocumentedJsdocBefore(text, index) {
  let i = index;
  while (i > 0 && /\s/.test(text[i - 1])) {
    i -= 1;
  }
  if (i < 2 || text.slice(i - 2, i) !== "*/") {
    return false;
  }
  const closer = i - 2;
  const opener = text.lastIndexOf("/**", closer);
  if (opener === -1) {
    return false;
  }
  if (text.indexOf("*/", opener + 3) !== closer) {
    return false;
  }
  return DOCUMENTED_TAG.test(text.slice(opener, i));
}

function commentsHaveDocumentedTag(comments) {
  if (!Array.isArray(comments)) {
    return false;
  }
  for (const comment of comments) {
    if (comment.type !== "Block") {
      continue;
    }
    const value = comment.value ?? "";
    if (value.startsWith("*") && DOCUMENTED_TAG.test(value)) {
      return true;
    }
  }
  return false;
}

function jsdocTargets(node) {
  const targets = [node];
  let current = node;
  while (current.parent) {
    const parent = current.parent;
    if (parent.type === "Property" && parent.value === current) {
      targets.push(parent);
      current = parent;
      continue;
    }
    if (parent.type === "VariableDeclarator" && parent.init === current) {
      targets.push(parent);
      current = parent;
      continue;
    }
    if (parent.type === "VariableDeclaration" && parent.declarations.includes(current)) {
      targets.push(parent);
      current = parent;
      continue;
    }
    if (parent.type === "ExportNamedDeclaration" && parent.declaration === current) {
      targets.push(parent);
      current = parent;
      continue;
    }
    if (parent.type === "AssignmentExpression" && parent.right === current) {
      targets.push(parent);
      current = parent;
      continue;
    }
    break;
  }
  return targets;
}

function hasDocumentedJsdoc(context, node) {
  const sourceCode = context.sourceCode;
  const text = sourceText(context);
  const getCommentsBefore =
    typeof sourceCode.getCommentsBefore === "function"
      ? (target) => sourceCode.getCommentsBefore(target)
      : null;

  for (const target of jsdocTargets(node)) {
    if (getCommentsBefore && commentsHaveDocumentedTag(getCommentsBefore(target))) {
      return true;
    }
    if (commentsHaveDocumentedTag(target.leadingComments)) {
      return true;
    }
    const start = nodeStart(target);
    if (typeof start === "number" && hasDocumentedJsdocBefore(text, start)) {
      return true;
    }
  }
  return false;
}

function collectVBindings(node, vNames, nsNames) {
  if (node.source.type !== "Literal" || node.source.value !== CONVEX_VALUES) {
    return;
  }
  for (const specifier of node.specifiers) {
    if (specifier.type === "ImportNamespaceSpecifier") {
      nsNames.add(specifier.local.name);
      continue;
    }
    if (specifier.type === "ImportSpecifier" && importedName(specifier) === "v") {
      vNames.add(specifier.local.name);
    }
  }
}

function isVOptionalCallee(callee, vNames, nsNames) {
  if (callee.type !== "MemberExpression") {
    return false;
  }
  if (memberName(callee.property, callee.computed) !== "optional") {
    return false;
  }
  const object = callee.object;
  if (object.type === "Identifier" && vNames.has(object.name)) {
    return true;
  }
  if (
    object.type === "MemberExpression" &&
    object.object.type === "Identifier" &&
    nsNames.has(object.object.name) &&
    memberName(object.property, object.computed) === "v"
  ) {
    return true;
  }
  return false;
}

const noUndocumentedOptional = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Convex `v.optional()` unless marked `@todo` or `@deprecated` as a migration transient",
    },
    schema: [],
    messages: {
      undocumented: MESSAGE,
    },
  },

  create(context) {
    const filename = context.physicalFilename ?? "";
    if (CONFIG_FILE.test(filename)) {
      return {};
    }

    const vNames = new Set();
    const nsNames = new Set();

    return {
      ImportDeclaration(node) {
        collectVBindings(node, vNames, nsNames);
      },
      CallExpression(node) {
        if (!isVOptionalCallee(node.callee, vNames, nsNames)) {
          return;
        }
        if (hasDocumentedJsdoc(context, node)) {
          return;
        }
        context.report({ node, messageId: "undocumented" });
      },
    };
  },
});

export { noUndocumentedOptional };
