import { expect, test } from "@playwright/test";

test("born baby page fits within a mobile viewport", async ({ page }) => {
  await page.goto("/baby/baby-born");
  await expect(page.getByRole("heading", { name: "Is Baby Born out yet?" })).toBeVisible();

  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));

  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});
