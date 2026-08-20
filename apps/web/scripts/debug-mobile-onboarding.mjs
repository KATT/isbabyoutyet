import { appendFileSync } from "node:fs";
import { chromium } from "playwright";

const LOG_PATH = "/opt/cursor/logs/debug.log";
const APP_URL = "http://localhost:3000";

function log(payload) {
  appendFileSync(
    LOG_PATH,
    `${JSON.stringify({ ...payload, timestamp: Date.now() })}\n`,
  );
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  isMobile: true,
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();

await page.goto(`${APP_URL}/auth/login`);
await page.waitForLoadState("networkidle");
await page.getByLabel("Email").fill("test+newuser@example.com");
await page.getByLabel("Password").fill("password");
await page.getByRole("button", { name: "Sign In" }).click();
await page.waitForURL("**/dashboard");
await page.getByText("Your babies").waitFor();
const restart = page.getByRole("button", { name: "Restart getting started tour" });
if (await restart.isVisible()) {
  await restart.click();
}
const expand = page.getByRole("button", { name: /Getting started: .* Expand/ });
await expand.waitFor();
await expand.evaluate((element) => {
  const dock = element.closest("aside");
  return Promise.all((dock?.getAnimations() ?? []).map((animation) => animation.finished));
});

const metrics = await page.evaluate(() => ({
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  clientWidth: document.documentElement.clientWidth,
  clientHeight: document.documentElement.clientHeight,
  visualWidth: window.visualViewport?.width ?? null,
  visualHeight: window.visualViewport?.height ?? null,
  visualOffsetTop: window.visualViewport?.offsetTop ?? null,
  visualOffsetLeft: window.visualViewport?.offsetLeft ?? null,
  visualScale: window.visualViewport?.scale ?? null,
}));
// #region agent log
log({
  hypothesisId: "A,B",
  location: "debug-mobile-onboarding.mjs:login",
  message: "Viewport metrics after mobile login",
  data: metrics,
});
// #endregion

const dock = await page
  .locator('aside[aria-label="Getting started checklist"]')
  .evaluateAll((elements) => {
    const element = elements.find((candidate) => candidate.getBoundingClientRect().width > 0);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      },
      bottom: style.bottom,
      position: style.position,
      width: style.width,
    };
  });
// #region agent log
log({
  hypothesisId: "A,D",
  location: "debug-mobile-onboarding.mjs:dock",
  message: "Compact dock geometry and fixed-position styles",
  data: { dock },
});
// #endregion

const hitTarget = await expand.evaluate((element) => {
  const rect = element.getBoundingClientRect();
  const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return {
    expandRect: {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    },
    hitTag: target?.tagName ?? null,
    hitAriaLabel: target?.getAttribute("aria-label") ?? null,
    hitParentTag: target?.parentElement?.tagName ?? null,
  };
});
// #region agent log
log({
  hypothesisId: "D",
  location: "debug-mobile-onboarding.mjs:hit-test",
  message: "Hit target at compact dock expand button center",
  data: hitTarget,
});
// #endregion

await page.evaluate(() => {
  window.__agentVisualViewportEvents = 0;
  window.visualViewport?.addEventListener("resize", () => {
    window.__agentVisualViewportEvents += 1;
  });
});
await page.setViewportSize({ width: 391, height: 845 });
await page.setViewportSize({ width: 390, height: 844 });
const viewportEventCount = await page.evaluate(() => window.__agentVisualViewportEvents);
await expand.evaluate((element) => {
  const dock = element.closest("aside");
  return Promise.all((dock?.getAnimations() ?? []).map((animation) => animation.finished));
});
// #region agent log
log({
  hypothesisId: "C",
  location: "debug-mobile-onboarding.mjs:viewport-events",
  message: "Visual viewport resize events after viewport changes",
  data: { viewportEventCount },
});
// #endregion

let clickResult;
try {
  await expand.click({ trial: true, timeout: 3_000 });
  clickResult = { clickable: true, error: null };
} catch (error) {
  clickResult = {
    clickable: false,
    error: error instanceof Error ? error.message.slice(0, 500) : "Unknown click error",
  };
}
// #region agent log
log({
  hypothesisId: "D",
  location: "debug-mobile-onboarding.mjs:click",
  message: "Playwright normal-actionability click trial",
  data: clickResult,
});
// #endregion

if (clickResult.clickable) {
  await expand.click();
}
const drawer = page.getByRole("dialog", { name: "Getting started" });
if (clickResult.clickable) {
  await drawer.waitFor();
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-slot="drawer-popup"]');
    const viewport = window.visualViewport;
    if (!element || !viewport) return false;
    const rect = element.getBoundingClientRect();
    return rect.top >= viewport.offsetTop && rect.bottom <= viewport.offsetTop + viewport.height;
  });
}
const drawerState = clickResult.clickable
  ? await drawer.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        visible: rect.width > 0 && rect.height > 0,
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        },
      };
    })
  : { visible: false, rect: null };
// #region agent log
log({
  hypothesisId: "A,D",
  location: "debug-mobile-onboarding.mjs:drawer",
  message: "Drawer state after expand interaction",
  data: drawerState,
});
// #endregion

await browser.close();
