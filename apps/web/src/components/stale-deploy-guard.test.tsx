import { render, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";

const mocks = vi.hoisted(() => ({
  gitSha: "development",
  bindHardNavigation: vi.fn<(router: unknown, assign: (href: string) => void) => () => void>(
    () => () => {},
  ),
  bindStaleReloadTriggers: vi.fn<() => () => void>(() => () => {}),
  router: {},
}));

vi.mock("@workspace/convex-prefetch", () => ({
  usePreloadedConvexQuery: () => ({ data: mocks.gitSha }),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/lib/stale-deploy", () => ({
  bindHardNavigation: mocks.bindHardNavigation,
  bindStaleReloadTriggers: mocks.bindStaleReloadTriggers,
}));

const { StaleDeployGuard } = await import("./stale-deploy-guard");

const gitShaHandle = { input: {}, initialData: "abc123" };

function renderGuard() {
  const view = render(<StaleDeployGuard gitSha={gitShaHandle as never} />);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("a matching deploy hash does not force hard navigation", async () => {
  mocks.gitSha = "abc123";
  mocks.bindHardNavigation.mockClear();
  mocks.bindStaleReloadTriggers.mockClear();

  await using _view = renderGuard();

  expect(mocks.bindHardNavigation).not.toHaveBeenCalled();
  expect(mocks.bindStaleReloadTriggers).not.toHaveBeenCalled();
});

test("a changed deploy hash forces hard navigation and visible reloads", async () => {
  mocks.gitSha = "abc123";
  mocks.bindHardNavigation.mockClear();
  mocks.bindStaleReloadTriggers.mockClear();

  await using view = renderGuard();

  mocks.gitSha = "def456";
  view.rerender(<StaleDeployGuard gitSha={gitShaHandle as never} />);

  await waitFor(() => {
    expect(mocks.bindHardNavigation).toHaveBeenCalled();
  });
  expect(mocks.bindHardNavigation.mock.calls[0]?.[0]).toBe(mocks.router);
  expect(mocks.bindStaleReloadTriggers).toHaveBeenCalled();
});
