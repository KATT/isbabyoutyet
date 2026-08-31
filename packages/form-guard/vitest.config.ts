import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "form-guard",
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
