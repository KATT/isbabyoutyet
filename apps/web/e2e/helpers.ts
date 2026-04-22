import { expect, type Page } from "@playwright/test";

type TestUser = {
  slug: string;
  name: string;
  email: string;
  password: string;
};

function makeSlug(prefix: string) {
  const uniquePart = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${uniquePart}`;
}

export function uniqueUser(prefix: string): TestUser {
  const slug = makeSlug(prefix);

  return {
    slug,
    name: `Playwright ${slug}`,
    email: `${slug}@example.com`,
    password: `Password!${slug}`,
  };
}

export async function goToSignupFromHome(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Get Started" }).click();
  await expect(page).toHaveURL(/\/auth\/signup$/);
}

export async function signUp(page: Page, user: TestUser) {
  await page.getByLabel("Name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign Up" }).click();
}

export async function signIn(page: Page, user: TestUser) {
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

export async function expectOnDashboard(page: Page) {
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Your Babies" })).toBeVisible();
}

export async function createBabyFromDashboard(
  page: Page,
  opts: {
    babyName: string;
    dueDate: string;
  },
) {
  await page.getByRole("link", { name: /Add Baby/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/add$/);

  await page.getByLabel("Baby Name").fill(opts.babyName);
  await page.getByLabel("Due Date").fill(opts.dueDate);
  await page.getByRole("button", { name: "Add Baby" }).click();

  await expect(page).toHaveURL(/\/baby\/.+\?settings=true$/);
  const currentUrl = new URL(page.url());
  const match = currentUrl.pathname.match(/^\/baby\/([^/]+)$/);
  if (!match) {
    throw new Error(`Expected baby URL, received ${page.url()}`);
  }

  return match[1];
}

export async function expectPublicBabyPage(page: Page, babyName: string) {
  await expect(page.getByRole("heading", { name: `Is ${babyName} out yet?` })).toBeVisible();
  await expect(page.getByRole("button", { name: "Get Notifications" })).toBeVisible();
}

export async function visitPublicBabyPage(
  page: Page,
  publicId: string,
  search?: Record<string, string | boolean>,
) {
  const url = new URL(`/baby/${publicId}`, "http://localhost:3000");
  if (search) {
    for (const [key, value] of Object.entries(search)) {
      url.searchParams.set(key, String(value));
    }
  }
  await page.goto(url.toString());
}

export async function markBabyStatus(page: Page, label: "Labour started" | "Gone to hospital" | "Baby born") {
  await page.locator('a[href*="settings=true"]').click();
  await expect(page.getByRole("button", { name: `Mark as ${label}` })).toBeVisible();
  await page.getByRole("button", { name: `Mark as ${label}` }).click();
}
