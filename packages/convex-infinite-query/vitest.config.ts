import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "convex-infinite-query",
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
