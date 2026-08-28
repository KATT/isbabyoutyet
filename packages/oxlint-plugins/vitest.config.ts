import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "oxlint-plugins",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
