import { defineProject } from "vitest/config";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineProject({
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    viteReact(),
  ],
  test: {
    name: "web",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    server: {
      deps: {
        // Needed when web tests pull in convex-test + the table-history component
        inline: ["convex-table-history"],
      },
    },
  },
});
