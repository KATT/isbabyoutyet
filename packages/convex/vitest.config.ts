import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "convex",
    // Approximate the Convex runtime better than node
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    env: {
      SITE_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test-secret-for-vitest-at-least-32-chars",
    },
    server: {
      deps: {
        // Bundle component packages so their source can be imported directly
        // in tests via t.registerComponent
        inline: ["convex-table-history", "@convex-dev/better-auth"],
      },
    },
  },
});
