/**
 * CRAP (Change Risk Anti-Patterns) analysis.
 *
 * CRAP(fn) = complexity(fn)^2 * (1 - coverage(fn))^3 + complexity(fn)
 *
 * - complexity: cyclomatic complexity computed from the AST, matching the
 *   counting used by ESLint/oxlint's `complexity` rule.
 * - coverage: statement coverage of the function body, taken from Vitest's
 *   istanbul-format `coverage/coverage-final.json` (v8 provider).
 *
 * A function is "CRAPpy" when its score exceeds THRESHOLD (30, the canonical
 * value from Alberto Savoia & Bob Evans' crap4j). Known offenders live in
 * `crap-baseline.json` — the ratchet: new offenders and regressions fail, and
 * entries that improve must be removed via `--update-baseline`.
 *
 * Usage:
 *   pnpm test:coverage          # produce coverage data first
 *   pnpm crap                   # analyze + enforce
 *   pnpm crap --update-baseline # rewrite the baseline after fixing/refactoring
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as babelParser from "@babel/parser";

const THRESHOLD = 30;
// Tolerance for float noise so unrelated runs don't flip results.
const EPSILON = 0.05;
const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const COVERAGE_FILE = path.join(REPO_ROOT, "coverage", "coverage-final.json");
const BASELINE_FILE = path.join(REPO_ROOT, "crap-baseline.json");

type IstanbulLocation = {
  start: { line: number; column: number | null };
  end: { line: number | null; column: number | null };
};

type IstanbulFileCoverage = {
  path: string;
  statementMap: Record<string, IstanbulLocation>;
  fnMap: Record<string, { name: string; decl: IstanbulLocation; loc: IstanbulLocation }>;
  s: Record<string, number>;
  f: Record<string, number>;
};

type FunctionStats = {
  file: string;
  name: string;
  line: number;
  start: number;
  end: number;
  complexity: number;
  totalStatements: number;
  coveredStatements: number;
  executed: boolean;
};

type Baseline = {
  threshold: number;
  entries: Record<string, number>;
};

/** Loosely-typed Babel AST node — we walk it generically. */
type AstNode = {
  type: string;
  start: number;
  end: number;
  loc: { start: { line: number } };
  [key: string]: unknown;
};

function isAstNode(value: unknown): value is AstNode {
  return (
    typeof value === "object" && value !== null && typeof (value as AstNode).type === "string"
  );
}

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ObjectMethod",
  "ClassMethod",
  "ClassPrivateMethod",
]);

function isDecisionPoint(node: AstNode): boolean {
  switch (node.type) {
    case "IfStatement":
    case "ConditionalExpression":
    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement":
    case "WhileStatement":
    case "DoWhileStatement":
    case "CatchClause":
      return true;
    case "SwitchCase":
      // `default:` does not add a path
      return node.test !== null;
    case "LogicalExpression":
      return node.operator === "&&" || node.operator === "||" || node.operator === "??";
    case "AssignmentExpression":
      return node.operator === "&&=" || node.operator === "||=" || node.operator === "??=";
    // Each `?.` adds a path, matching oxlint's counting
    case "OptionalMemberExpression":
    case "OptionalCallExpression":
      return node.optional === true;
    default:
      return false;
  }
}

function identifierName(value: unknown): string | null {
  if (!isAstNode(value)) {
    return null;
  }
  if (value.type === "Identifier" && typeof value.name === "string") {
    return value.name;
  }
  if (value.type === "StringLiteral" && typeof value.value === "string") {
    return value.value;
  }
  return null;
}

/** Name contributed by an ancestor node, e.g. `update` in `const update = ...`. */
function contextName(node: AstNode): string | null {
  switch (node.type) {
    case "VariableDeclarator":
      return identifierName(node.id);
    case "ObjectProperty":
      return identifierName(node.key);
    case "ClassDeclaration":
    case "ClassExpression":
      return identifierName(node.id);
    case "JSXAttribute": {
      const name = node.name;
      return isAstNode(name) && typeof name.name === "string" ? name.name : null;
    }
    default:
      return null;
  }
}

function ownName(node: AstNode): string | null {
  switch (node.type) {
    case "FunctionDeclaration":
    case "FunctionExpression":
      return identifierName(node.id);
    case "ObjectMethod":
    case "ClassMethod":
    case "ClassPrivateMethod":
      return identifierName(node.key);
    default:
      return null;
  }
}

function collectFunctions(program: AstNode, relPath: string): FunctionStats[] {
  const functions: FunctionStats[] = [];
  const functionStack: FunctionStats[] = [];
  const nameStack: string[] = [];

  function visitChildren(node: AstNode): void {
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isAstNode(item)) {
            visit(item);
          }
        }
      } else if (isAstNode(value)) {
        visit(value);
      }
    }
  }

  function visit(node: AstNode): void {
    const context = contextName(node);
    if (context) {
      nameStack.push(context);
    }

    if (FUNCTION_TYPES.has(node.type)) {
      const own = ownName(node);
      const qualified = [...nameStack, ...(own && own !== nameStack.at(-1) ? [own] : [])];
      const fn: FunctionStats = {
        file: relPath,
        name: qualified.length > 0 ? qualified.join(".") : "<anonymous>",
        line: node.loc.start.line,
        start: node.start,
        end: node.end,
        complexity: 1,
        totalStatements: 0,
        coveredStatements: 0,
        executed: false,
      };
      functions.push(fn);
      functionStack.push(fn);
      visitChildren(node);
      functionStack.pop();
    } else {
      const currentFunction = functionStack.at(-1);
      if (currentFunction && isDecisionPoint(node)) {
        currentFunction.complexity++;
      }
      visitChildren(node);
    }

    if (context) {
      nameStack.pop();
    }
  }

  visit(program);

  // Disambiguate duplicate qualified names deterministically by position.
  const seen = new Map<string, number>();
  for (const fn of functions.toSorted((a, b) => a.start - b.start)) {
    const count = seen.get(fn.name) ?? 0;
    seen.set(fn.name, count + 1);
    if (count > 0) {
      fn.name = `${fn.name}#${count + 1}`;
    }
  }

  return functions;
}

/** Innermost function whose range contains `offset`. */
function innermostFunctionAt(functions: FunctionStats[], offset: number): FunctionStats | null {
  let best: FunctionStats | null = null;
  for (const fn of functions) {
    if (offset < fn.start || offset >= fn.end) {
      continue;
    }
    if (!best || fn.end - fn.start < best.end - best.start) {
      best = fn;
    }
  }
  return best;
}

/** Start offset (UTF-16 code units, same unit as Babel spans) of each line. */
function buildLineOffsets(sourceText: string): number[] {
  const offsets = [0];
  for (let i = 0; i < sourceText.length; i++) {
    if (sourceText[i] === "\n") {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

function offsetOf(lineOffsets: number[], loc: IstanbulLocation["start"]): number | null {
  const lineStart = lineOffsets[loc.line - 1];
  if (lineStart === undefined) {
    return null;
  }
  return lineStart + (loc.column ?? 0);
}

function analyzeFile(fileCoverage: IstanbulFileCoverage): FunctionStats[] {
  const filePath = fileCoverage.path;
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const sourceText = fs.readFileSync(filePath, "utf8");
  const ast = babelParser.parse(sourceText, {
    sourceType: "unambiguous",
    plugins: ["typescript", "jsx"],
    errorRecovery: true,
  });
  const relPath = path.relative(REPO_ROOT, filePath);
  const functions = collectFunctions(ast.program as unknown as AstNode, relPath);
  const lineOffsets = buildLineOffsets(sourceText);

  for (const [key, stmt] of Object.entries(fileCoverage.statementMap)) {
    const offset = offsetOf(lineOffsets, stmt.start);
    if (offset === null) {
      continue;
    }
    const fn = innermostFunctionAt(functions, offset);
    if (!fn) {
      continue;
    }
    fn.totalStatements++;
    if ((fileCoverage.s[key] ?? 0) > 0) {
      fn.coveredStatements++;
    }
  }

  // Fallback signal for bodies that produce no istanbul statements
  // (e.g. single-expression arrows): did the function ever run?
  for (const [key, fnEntry] of Object.entries(fileCoverage.fnMap)) {
    if ((fileCoverage.f[key] ?? 0) === 0) {
      continue;
    }
    const offset = offsetOf(lineOffsets, fnEntry.decl.start);
    if (offset === null) {
      continue;
    }
    const fn = innermostFunctionAt(functions, offset);
    if (fn) {
      fn.executed = true;
    }
  }

  return functions;
}

function coverageOf(fn: FunctionStats): number {
  if (fn.totalStatements === 0) {
    return fn.executed ? 1 : 0;
  }
  return fn.coveredStatements / fn.totalStatements;
}

function crapScore(fn: FunctionStats): number {
  const coverage = coverageOf(fn);
  return fn.complexity ** 2 * (1 - coverage) ** 3 + fn.complexity;
}

function loadBaseline(): Baseline {
  if (!fs.existsSync(BASELINE_FILE)) {
    return { threshold: THRESHOLD, entries: {} };
  }
  return JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")) as Baseline;
}

function formatRow(cells: string[], widths: number[]): string {
  return cells
    .map((cell, i) => (i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i])))
    .join("  ");
}

function main(): void {
  if (!fs.existsSync(COVERAGE_FILE)) {
    console.error(
      `Missing ${path.relative(REPO_ROOT, COVERAGE_FILE)} — run \`pnpm test:coverage\` first.`,
    );
    process.exit(1);
  }

  const updateBaseline = process.argv.includes("--update-baseline");
  const coverageData = JSON.parse(fs.readFileSync(COVERAGE_FILE, "utf8")) as Record<
    string,
    IstanbulFileCoverage
  >;

  const allFunctions = Object.values(coverageData)
    .flatMap((fileCoverage) => analyzeFile(fileCoverage))
    .toSorted((a, b) => crapScore(b) - crapScore(a));

  const crappy = allFunctions.filter((fn) => crapScore(fn) > THRESHOLD + EPSILON);

  // Report the top of the leaderboard.
  const top = allFunctions.slice(0, 15);
  const rows = top.map((fn) => [
    `${fn.file}:${fn.line} ${fn.name}`,
    String(fn.complexity),
    `${Math.round(coverageOf(fn) * 100)}%`,
    crapScore(fn).toFixed(1),
  ]);
  const header = ["function", "complexity", "coverage", "CRAP"];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  console.log(`CRAP analysis: ${allFunctions.length} functions, threshold ${THRESHOLD}\n`);
  console.log(formatRow(header, widths));
  console.log(
    formatRow(
      widths.map((w) => "-".repeat(w)),
      widths,
    ),
  );
  for (const row of rows) {
    console.log(formatRow(row, widths));
  }
  console.log();

  const baselineKey = (fn: FunctionStats): string => `${fn.file}::${fn.name}`;

  if (updateBaseline) {
    const entries = Object.fromEntries(
      crappy
        .toSorted((a, b) => baselineKey(a).localeCompare(baselineKey(b)))
        .map((fn) => [baselineKey(fn), Number(crapScore(fn).toFixed(1))]),
    );
    fs.writeFileSync(
      BASELINE_FILE,
      `${JSON.stringify({ threshold: THRESHOLD, entries }, null, 2)}\n`,
    );
    console.log(
      `Baseline updated: ${Object.keys(entries).length} known offenders in crap-baseline.json`,
    );
    return;
  }

  const baseline = loadBaseline();
  const problems: string[] = [];
  const currentKeys = new Set<string>();

  for (const fn of crappy) {
    const key = baselineKey(fn);
    currentKeys.add(key);
    const score = crapScore(fn);
    const allowed = baseline.entries[key];
    if (allowed === undefined) {
      problems.push(
        `NEW offender: ${key} (CRAP ${score.toFixed(1)}) — refactor it, cover it with tests, or add it to the baseline via \`pnpm crap --update-baseline\``,
      );
    } else if (score > allowed + EPSILON) {
      problems.push(
        `REGRESSION: ${key} got worse (CRAP ${allowed} -> ${score.toFixed(1)}) — refactor or add tests to bring it back down`,
      );
    }
  }

  for (const key of Object.keys(baseline.entries)) {
    if (!currentKeys.has(key)) {
      problems.push(
        `STALE baseline entry: ${key} no longer exceeds the threshold — shrink the ratchet with \`pnpm crap --update-baseline\``,
      );
    }
  }

  if (problems.length > 0) {
    console.error(`CRAP check failed:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    process.exit(1);
  }

  console.log(
    `CRAP check passed: ${crappy.length} known offenders within baseline, 0 new, 0 regressions.`,
  );
}

main();
