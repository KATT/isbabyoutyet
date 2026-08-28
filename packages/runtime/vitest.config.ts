import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "runtime",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
