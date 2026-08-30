import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/compareCoverage.ts"],
  format: "esm",
  outDir: "dist",
  clean: true,
  platform: "node",
  deps: {
    alwaysBundle: [/^@workspace\/runtime(?:\/|$)/],
  },
  outExtensions: () => ({ js: ".js" }),
});
