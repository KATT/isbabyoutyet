import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Approximate the Convex runtime better than node
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: {
      deps: {
        // Bundle convex-table-history so its component source (.ts) can be
        // imported directly in tests via t.registerComponent
        inline: ["convex-table-history"],
      },
    },
  },
});
