import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "convex-prefetch",
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
