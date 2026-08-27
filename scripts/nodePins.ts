import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export type NodePinSnapshot = {
  nvmrc: string;
  packageJson: string;
  convexJson: string;
  workflow: string;
};

const node20ActionPins = [
  "actions/checkout@v4",
  "actions/setup-node@v4",
  "actions/cache@v4",
  "actions/cache/restore@v4",
  "actions/cache/save@v4",
  "pnpm/action-setup@v4",
] as const;

export function nvmrcMajor(contents: string) {
  const major = contents.trim();
  if (!/^\d+$/.test(major)) {
    throw new Error(`.nvmrc must be a Node major (got ${JSON.stringify(contents)})`);
  }
  return major;
}

export function enginesRangeForMajor(major: string) {
  return `^${major}.0.0`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function packageEnginesNode(packageJson: string) {
  const parsed: unknown = JSON.parse(packageJson);
  if (!isRecord(parsed) || !isRecord(parsed["engines"])) {
    throw new Error("package.json is missing engines");
  }
  const node = parsed["engines"]["node"];
  if (typeof node !== "string") {
    throw new Error("package.json engines.node must be a string");
  }
  return node;
}

function convexNodeVersion(convexJson: string) {
  const parsed: unknown = JSON.parse(convexJson);
  if (!isRecord(parsed) || !isRecord(parsed["node"])) {
    throw new Error("convex.json is missing node");
  }
  const nodeVersion = parsed["node"]["nodeVersion"];
  if (typeof nodeVersion !== "string") {
    throw new Error("convex.json node.nodeVersion must be a string");
  }
  return nodeVersion;
}

export function listNodePinMismatches(pins: NodePinSnapshot) {
  const major = nvmrcMajor(pins.nvmrc);
  const expectedEngines = enginesRangeForMajor(major);
  const mismatches: Array<string> = [];

  const enginesNode = packageEnginesNode(pins.packageJson);
  if (enginesNode !== expectedEngines) {
    mismatches.push(
      `package.json engines.node is ${JSON.stringify(enginesNode)}, expected ${JSON.stringify(expectedEngines)}`,
    );
  }

  const convexVersion = convexNodeVersion(pins.convexJson);
  if (convexVersion !== major) {
    mismatches.push(
      `packages/convex/convex.json node.nodeVersion is ${JSON.stringify(convexVersion)}, expected ${JSON.stringify(major)}`,
    );
  }

  if (!pins.workflow.includes("node-version-file:")) {
    mismatches.push(".github/workflows/main.yml must set setup-node node-version-file to .nvmrc");
  }
  if (!pins.workflow.includes(".nvmrc")) {
    mismatches.push(".github/workflows/main.yml must reference .nvmrc");
  }

  const hardcodedVersion = new RegExp(`node-version:\\s*["']?(?!${major}\\b)`);
  if (/\bnode-version:/.test(pins.workflow) && hardcodedVersion.test(pins.workflow)) {
    mismatches.push(`.github/workflows/main.yml hardcodes a node-version other than ${major}`);
  }

  for (const pin of node20ActionPins) {
    if (pins.workflow.includes(pin)) {
      mismatches.push(`.github/workflows/main.yml still uses ${pin} (Node 20 action runtime)`);
    }
  }

  return mismatches;
}

export async function readRepoNodePins(repoRoot: string) {
  const [nvmrc, packageJson, convexJson, workflow] = await Promise.all([
    readFile(path.join(repoRoot, ".nvmrc"), "utf8"),
    readFile(path.join(repoRoot, "package.json"), "utf8"),
    readFile(path.join(repoRoot, "packages/convex/convex.json"), "utf8"),
    readFile(path.join(repoRoot, ".github/workflows/main.yml"), "utf8"),
  ]);

  return { nvmrc, packageJson, convexJson, workflow } satisfies NodePinSnapshot;
}

async function main() {
  const pins = await readRepoNodePins(process.cwd());
  const mismatches = listNodePinMismatches(pins);
  if (mismatches.length === 0) {
    return;
  }
  throw new Error(`Node version pins drifted:\n- ${mismatches.join("\n- ")}`);
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && fileURLToPath(import.meta.url) === path.resolve(invokedPath)) {
  await main();
}
