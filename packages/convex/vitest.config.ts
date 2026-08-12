import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "convex",
    // Approximate the Convex runtime better than node
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts", "src/**/*.test.ts"],
    server: {
      deps: {
        // Bundle convex-table-history so its component source (.ts) can be
        // imported directly in tests via t.registerComponent
        inline: ["convex-table-history"],
      },
    },
  },
});
