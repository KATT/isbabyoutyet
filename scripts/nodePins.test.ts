import { describe, expect, test } from "vitest";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import {
  enginesRangeForMajor,
  listNodePinMismatches,
  nvmrcMajor,
  readRepoNodePins,
} from "./nodePins.ts";

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

describe("Node version pins", () => {
  test("nvmrc is a Node major", () => {
    expect(nvmrcMajor("24\n")).toBe("24");
    expect(() => nvmrcMajor("v24")).toThrow(/major/);
  });

  test("engines range matches the nvmrc major", () => {
    expect(enginesRangeForMajor("24")).toBe("^24.0.0");
  });

  test("repo pins stay aligned on the nvmrc major", async () => {
    const pins = await readRepoNodePins(repoRoot);
    expect(nvmrcMajor(pins.nvmrc)).toBe("24");
    expect(listNodePinMismatches(pins)).toEqual([]);
  });

  test("reports every drifted pin", () => {
    const mismatches = listNodePinMismatches({
      nvmrc: "24\n",
      packageJson: JSON.stringify({ engines: { node: "^20.0.0" } }),
      convexJson: JSON.stringify({ node: { nodeVersion: "20" } }),
      workflow: `
        uses: actions/checkout@v4
        uses: pnpm/action-setup@v4
        uses: actions/setup-node@v4
        with:
          node-version: "20"
        uses: actions/cache@v4
        uses: actions/cache/restore@v4
        uses: actions/cache/save@v4
      `,
    });

    expect(mismatches).toEqual([
      'package.json engines.node is "^20.0.0", expected "^24.0.0"',
      'packages/convex/convex.json node.nodeVersion is "20", expected "24"',
      ".github/workflows/main.yml must set setup-node node-version-file to .nvmrc",
      ".github/workflows/main.yml must reference .nvmrc",
      ".github/workflows/main.yml hardcodes a node-version other than 24",
      ".github/workflows/main.yml still uses actions/checkout@v4 (Node 20 action runtime)",
      ".github/workflows/main.yml still uses actions/setup-node@v4 (Node 20 action runtime)",
      ".github/workflows/main.yml still uses actions/cache@v4 (Node 20 action runtime)",
      ".github/workflows/main.yml still uses actions/cache/restore@v4 (Node 20 action runtime)",
      ".github/workflows/main.yml still uses actions/cache/save@v4 (Node 20 action runtime)",
      ".github/workflows/main.yml still uses pnpm/action-setup@v4 (Node 20 action runtime)",
    ]);
  });
});
