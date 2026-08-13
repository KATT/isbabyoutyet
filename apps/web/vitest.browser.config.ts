import { playwright } from "@vitest/browser-playwright";
import { defineProject } from "vitest/config";
import type { BrowserCommand } from "vitest/node";

const VIEWPORT = { width: 393, height: 924 };
const APP_BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

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
        .sort((left, right) => right.right - left.right)[0] ?? null;

    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth,
      widest,
    };
  });
  await page.close();
  return result;
};

export default defineProject({
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
