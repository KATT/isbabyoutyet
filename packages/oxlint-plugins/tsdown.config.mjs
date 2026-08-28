import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["*.ts", "!**/*.test.ts", "!vitest.config.ts", "!tsdown.config.mjs"],
  format: "esm",
  outDir: "dist",
  unbundle: true,
  clean: true,
  outExtensions: () => ({ js: ".js" }),
});
