import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["workspace.ts", "anti-slop/index.ts"],
  format: "esm",
  outDir: "dist",
  clean: true,
  outExtensions: () => ({ js: ".js" }),
});
