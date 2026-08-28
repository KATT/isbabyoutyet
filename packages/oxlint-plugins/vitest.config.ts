import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "oxlint-plugins",
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
