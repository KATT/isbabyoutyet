import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineProject({
  plugins: [viteTsConfigPaths(), react()],
  test: {
    name: "rhythm-game",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
