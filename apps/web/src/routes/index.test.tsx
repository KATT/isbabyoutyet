import { fireEvent, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { HOMEPAGE_DEMO_BABIES, HOMEPAGE_DEMO_BABY } from "@workspace/convex/src/seedCredentials";
import { LocaleProvider } from "@/lib/i18n";
import { cookieName } from "@/paraglide/runtime";
import { HomePage } from "@/routes/index";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";

// No auth cookie and no reachable auth server in jsdom, so the real
// `authClient.useSession()` hook naturally resolves to a logged-out session
// — no need to spy on it (it's a Proxy anyway, so vi.spyOn can't attach).

test("homepage links visitors to the live Juniper Hale demo page", async () => {
  await using _view = await renderWithTestRouter(<HomePage />);

  const demoLinks = screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("href")?.includes(`/baby/${HOMEPAGE_DEMO_BABY.publicId}`));
  expect(demoLinks.length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: /is baby out yet/i })).toBeTruthy();
  expect(screen.getByText(`Follow ${HOMEPAGE_DEMO_BABY.name}'s arrival`)).toBeTruthy();

  const livePage = screen.getByRole("button", { name: /see a live page/i });
  const createPage = screen.getByRole("button", { name: /create your page/i });
  expect(livePage.parentElement).not.toBe(createPage.parentElement);
});

test("Swedish homepage links visitors to Ella Holm", async () => {
  await using _view = await renderWithTestRouter(
    <LocaleProvider locale="sv">
      <HomePage />
    </LocaleProvider>,
  );

  const demoLinks = screen
    .getAllByRole("link")
    .filter((link) =>
      link.getAttribute("href")?.includes(`/baby/${HOMEPAGE_DEMO_BABIES.sv.publicId}`),
    );
  expect(demoLinks.length).toBeGreaterThan(0);
  expect(screen.getByText("Följ med tills Ella Holm är här")).toBeTruthy();
});

test("homepage language picker saves an explicit language choice", async () => {
  document.cookie = `${cookieName}=; path=/; max-age=0`;
  await using _cookie = makeResource({}, () => {
    document.cookie = `${cookieName}=; path=/; max-age=0`;
  });
  await using _view = await renderWithTestRouter(<HomePage />);

  fireEvent.click(screen.getByRole("combobox", { name: "Language" }));
  const swedish = await screen.findByRole("option", { name: "Swedish" });
  fireEvent.pointerDown(swedish, { pointerType: "mouse" });
  fireEvent.click(swedish);

  await vi.waitFor(() => {
    expect(document.cookie).toContain(`${cookieName}=sv`);
  });
});
