import { act, fireEvent, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { HOMEPAGE_DEMO_BABIES, HOMEPAGE_DEMO_BABY } from "@workspace/convex/src/seedCredentials";
import { LocaleProvider } from "@/lib/i18n";
import { cookieName } from "@/paraglide/runtime";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { HomePage } from "./index";

// No auth cookie and no reachable auth server in jsdom, so the real
// `authClient.useSession()` hook naturally resolves to a logged-out session —
// no need to spy on it (it's a Proxy, so vi.spyOn can't attach).

test("homepage links visitors to the live Juniper Hale demo page", async () => {
  await using _view = await renderWithTestRouter(<HomePage />);

  const demoLinks = screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("href")?.includes(`/baby/${HOMEPAGE_DEMO_BABY.publicId}`));
  expect(demoLinks.length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: /is baby out yet/i })).toBeTruthy();
  expect(screen.getByText(`Follow ${HOMEPAGE_DEMO_BABY.name}'s arrival`)).toBeTruthy();

  // These CTAs render as Base UI Buttons backed by a Link (not native
  // anchors), so Base UI assigns them an accessible role of "button".
  const livePage = screen.getByRole("button", { name: /see a live page/i });
  const createPage = screen.getByRole("button", { name: /create your page/i });
  expect(livePage.parentElement).not.toBe(createPage.parentElement);
});

test("hero headline cycles through baby names", async () => {
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => vi.useRealTimers());
  await using _view = await renderWithTestRouter(<HomePage />);

  expect(screen.getByRole("heading", { name: /is baby out yet/i })).toBeTruthy();
  expect(screen.queryByText("Juniper")).toBeNull();
  act(() => vi.advanceTimersByTime(2400));
  expect(screen.getByText("Juniper").getAttribute("data-hero-word")).toBe("in");
});

test("Swedish homepage hero uses Swedish name pool", async () => {
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => vi.useRealTimers());
  await using _view = await renderWithTestRouter(
    <LocaleProvider locale="sv">
      <HomePage />
    </LocaleProvider>,
  );

  act(() => vi.advanceTimersByTime(2400));
  expect(screen.getByText("Ella").getAttribute("data-hero-word")).toBe("in");
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

  const picker = screen.getByRole("combobox", { name: "Language" });
  expect(picker.textContent).toContain("British English");
  fireEvent.click(picker);
  const swedish = await screen.findByRole("option", { name: "svenska" });
  expect(screen.getByRole("option", { name: "British English" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "American English" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "español" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "português (Brasil)" })).toBeTruthy();
  fireEvent.pointerDown(swedish, { pointerType: "mouse" });
  fireEvent.click(swedish);

  await vi.waitFor(() => {
    expect(document.cookie).toContain(`${cookieName}=sv`);
  });
});
