import { render } from "@testing-library/react";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";
import { expect, test, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { makeResource } from "@workspace/convex/convex/test.resource";

async function renderRouteResource(path: string) {
  vi.stubGlobal("matchMedia", (query: string) => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    } satisfies MediaQueryList;
  });
  vi.stubGlobal("scrollTo", () => {});
  const convexClient = new ConvexReactClient("https://example.convex.cloud");
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { convexClient },
  });
  await router.load();
  const view = render(<RouterProvider router={router} />);
  return makeResource(view, async () => {
    view.unmount();
    await convexClient.close();
    vi.unstubAllGlobals();
  });
}

test("offers a generic password reset request form", async () => {
  await using view = await renderRouteResource("/auth/forgot-password");

  expect(view.getByRole("heading", { name: "Reset your password" })).toBeTruthy();
  expect(view.getByLabelText("Email")).toBeTruthy();
  expect(view.getByRole("button", { name: "Send reset link" })).toBeTruthy();
});

test("rejects a reset page without a valid token", async () => {
  await using view = await renderRouteResource("/auth/reset-password");

  expect(view.getByText("This reset link is invalid or has expired.")).toBeTruthy();
  expect(view.getByRole("link", { name: "Request another link" })).toBeTruthy();
});
