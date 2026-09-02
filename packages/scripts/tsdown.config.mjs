import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  deps: {
    alwaysBundle: [/^@workspace\/runtime(?:\/|$)/],
  },
  entry: ["src/compareCoverage.ts"],
  format: "esm",
  outDir: "dist",
  outExtensions: () => ({ js: ".js" }),
  platform: "node",
});
