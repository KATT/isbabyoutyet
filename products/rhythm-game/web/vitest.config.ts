import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: "rhythm-game",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
