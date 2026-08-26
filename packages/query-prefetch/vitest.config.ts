import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "query-prefetch",
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
