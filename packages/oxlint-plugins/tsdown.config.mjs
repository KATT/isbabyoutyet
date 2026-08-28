import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["workspace.ts"],
  format: "esm",
  outDir: "dist",
  clean: true,
  outExtensions: () => ({ js: ".js" }),
});
