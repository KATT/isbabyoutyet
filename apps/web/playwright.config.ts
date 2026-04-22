import { defineConfig, devices } from "@playwright/test";

const shouldReuseServer = !process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: [
    {
      command: "pnpm --dir ../../packages/convex dev",
      url: "http://127.0.0.1:3210",
      reuseExistingServer: shouldReuseServer,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    },
    {
      command: "pnpm dev",
      url: "http://localhost:3000",
      reuseExistingServer: shouldReuseServer,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    },
  ],
});
