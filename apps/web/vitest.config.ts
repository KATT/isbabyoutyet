import { fileURLToPath } from "node:url";
import { defineConfig, defineProject } from "vitest/config";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import stylex from "@stylexjs/unplugin";
import { playwright } from "@vitest/browser-playwright";
import type { BrowserCommand } from "vitest/node";

const VIEWPORT = { width: 393, height: 924 };
const APP_BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const WEB_ROOT = fileURLToPath(new URL(".", import.meta.url));

type PageCheckOptions = {
  path: string;
  heading: string;
  expectedText: string | null;
};

type OverflowResult = {
  documentWidth: number;
  viewportWidth: number;
  widest: {
    className: string;
    right: number;
    tagName: string;
  } | null;
};

const measureMobileOverflow: BrowserCommand<[PageCheckOptions], OverflowResult> = async (
  context,
  options,
) => {
  if (context.provider.name !== "playwright") {
    throw new Error(`Unsupported browser provider: ${context.provider.name}`);
  }

  const page = await context.context.newPage();
  await page.setViewportSize(VIEWPORT);
  await page.goto(new URL(options.path, APP_BASE_URL).href);
  await page.getByRole("heading", { name: options.heading }).waitFor();
  if (options.expectedText) {
    await page.getByText(options.expectedText, { exact: false }).first().waitFor();
  }

  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const widest =
      [...document.querySelectorAll("body *")]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tagName: element.tagName,
            className: typeof element.className === "string" ? element.className : "",
            right: rect.right,
          };
        })
        .toSorted((left, right) => right.right - left.right)[0] ?? null;

    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth,
      widest,
    };
  });
  await page.close();
  return result;
};

export const webUnitProject = defineProject({
  root: WEB_ROOT,
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    stylex.vite({
      useCSSLayers: true,
      runtimeInjection: false,
    }),
    viteReact(),
  ],
  test: {
    name: "web",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/**/*.browser.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    // Keep auth/Convex clients off real backends so unit tests never dial the
    // developer's running `pnpm dev` / Convex backend (ports 3000 / 3210) or
    // a publicly resolvable Convex host (example.convex.cloud resolves in DNS).
    env: {
      VITE_SITE_URL: "https://example.test",
      VITE_CONVEX_URL: "https://example.invalid",
      VITE_CONVEX_SITE_URL: "https://example.invalid",
      // convex-test runs real Convex functions (including scheduled cache purge).
      SITE_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test-secret-for-vitest-at-least-32-chars",
      CONVEX_SITE_URL: "https://convex.test",
      VAPID_PUBLIC_KEY: "test-vapid-public-key",
      VAPID_PRIVATE_KEY: "test-vapid-private-key",
    },
    server: {
      deps: {
        // Needed when web tests pull in convex-test + the table-history component
        inline: ["convex-table-history", "@workspace/ui-cssinjs", "@stylexjs/stylex"],
      },
    },
  },
});

export const webBrowserProject = defineProject({
  root: WEB_ROOT,
  test: {
    name: "web-browser",
    include: ["src/**/*.browser.test.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      commands: {
        measureMobileOverflow,
      },
    },
  },
});

export default defineConfig({
  test: {
    projects: [webUnitProject, webBrowserProject],
  },
});
