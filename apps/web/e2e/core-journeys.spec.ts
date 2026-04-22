import { expect, test } from "@playwright/test";
import {
  createBabyFromDashboard,
  expectOnDashboard,
  expectPublicBabyPage,
  goToSignupFromHome,
  login,
  markBabyStatus,
  signUp,
  uniqueUser,
  visitPublicBabyPage,
} from "./helpers";

test.describe("core user journeys", () => {
  test("redirects signed-out visitors away from the dashboard", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", { name: "Get Started" })).toBeVisible();
  });

  test("signs up, creates a baby, and updates the first status", async ({ page }) => {
    const user = uniqueUser("parent");
    const babyName = `Baby ${user.slug}`;

    await goToSignupFromHome(page);
    await signUp(page, user);
    await expectOnDashboard(page);

    const publicId = await createBabyFromDashboard(page, {
      babyName,
      dueDate: "2026-12-31",
    });

    await expectPublicBabyPage(page, babyName);
    await markBabyStatus(page, "Labour started");
    await expect(page.getByRole("heading", { name: "Labour started" })).toBeVisible();
    await expect(page.getByText("Not gone to hospital yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Unmark Labour started" })).toBeVisible();

    await page.goto("/dashboard");
    await expectOnDashboard(page);
    await expect(page.getByRole("link", { name: new RegExp(babyName) })).toBeVisible();

    await visitPublicBabyPage(page, publicId);
    await expect(page.getByRole("button", { name: "Get Notifications" })).toBeVisible();
  });

  test("lets a returning parent sign in and a visitor send encouragement", async ({
    browser,
    page,
  }) => {
    const owner = uniqueUser("owner");
    const babyName = `Shared ${owner.slug}`;
    const visitorName = "Supportive Friend";
    const visitorMessage = "You've got this! We are all cheering for you.";

    await goToSignupFromHome(page);
    await signUp(page, owner);
    await expectOnDashboard(page);

    const publicId = await createBabyFromDashboard(page, {
      babyName,
      dueDate: "2026-11-15",
    });

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/auth/login");
    await login(page, owner);
    await expectOnDashboard(page);

    const visitorContext = await browser.newContext({
      baseURL: "http://localhost:3000",
      serviceWorkers: "block",
    });
    const visitorPage = await visitorContext.newPage();

    await visitPublicBabyPage(visitorPage, publicId);
    await expectPublicBabyPage(visitorPage, babyName);
    await visitorPage.getByLabel("Your name").fill(visitorName);
    await visitorPage.getByLabel("Message").fill(visitorMessage);
    await visitorPage.getByRole("button", { name: "Send Encouragement" }).click();
    await expect(visitorPage.getByText("Your kind words have been sent!")).toBeVisible();
    await expect(visitorPage.getByText(visitorName)).toBeVisible();
    await expect(visitorPage.getByText(visitorMessage)).toBeVisible();

    await visitPublicBabyPage(page, publicId, { settings: true });
    await expectPublicBabyPage(page, babyName);
    await expect(page.getByText(visitorName)).toBeVisible();
    await expect(page.getByText(visitorMessage)).toBeVisible();

    await visitorContext.close();
  });
});
