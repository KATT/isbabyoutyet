import { render, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";

const mocks = vi.hoisted(() => ({
  gitSha: null as string | null | undefined,
  observe: vi.fn<(liveSha: string | null | undefined) => boolean>(() => false),
  bindHardNavigation: vi.fn<(router: unknown, assign: (href: string) => void) => () => void>(
    () => () => {},
  ),
  bindStaleReloadTriggers: vi.fn<() => () => void>(() => () => {}),
  router: {},
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mocks.gitSha }),
}));

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: () => ({ queryKey: ["gitSha"] }),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/lib/stale-deploy", () => ({
  createDeployShaWatch: () => ({ observe: mocks.observe }),
  bindHardNavigation: mocks.bindHardNavigation,
  bindStaleReloadTriggers: mocks.bindStaleReloadTriggers,
}));

const { StaleDeployGuard } = await import("./stale-deploy-guard");

function renderGuard() {
  const view = render(<StaleDeployGuard />);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("a matching deploy hash does not force hard navigation", async () => {
  mocks.gitSha = "abc123";
  mocks.observe.mockReset();
  mocks.observe.mockReturnValue(false);
  mocks.bindHardNavigation.mockClear();
  mocks.bindStaleReloadTriggers.mockClear();

  await using _view = renderGuard();

  expect(mocks.observe).toHaveBeenCalledWith("abc123");
  expect(mocks.bindHardNavigation).not.toHaveBeenCalled();
  expect(mocks.bindStaleReloadTriggers).not.toHaveBeenCalled();
});

test("a changed deploy hash forces hard navigation and visible reloads", async () => {
  mocks.gitSha = "def456";
  mocks.observe.mockReset();
  mocks.observe.mockReturnValue(true);
  mocks.bindHardNavigation.mockClear();
  mocks.bindStaleReloadTriggers.mockClear();

  await using _view = renderGuard();

  await waitFor(() => {
    expect(mocks.bindHardNavigation).toHaveBeenCalled();
  });
  expect(mocks.bindHardNavigation.mock.calls[0]?.[0]).toBe(mocks.router);
  expect(mocks.bindStaleReloadTriggers).toHaveBeenCalled();
});
