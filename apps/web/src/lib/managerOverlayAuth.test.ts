import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";

const getToken = vi.hoisted(() => vi.fn<() => Promise<string | null>>());

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (handler: unknown) => handler }),
}));

vi.mock("@/lib/auth-server", () => ({
  authServer: { getToken },
}));

const { authenticateManagerOverlaySsr } = await import("./managerOverlayAuth");

function withoutBrowserWindowResource() {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { value: undefined, configurable: true });
  return makeResource({}, () => {
    if (descriptor) {
      Object.defineProperty(globalThis, "window", descriptor);
    }
  });
}

function authContext() {
  const setServerAuth = vi.fn<(token: string) => void>();
  const setClientAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  return {
    context: {
      convexQueryClient: { serverHttpClient: { setAuth: setServerAuth } },
      convexClient: { setAuth: setClientAuth },
    },
    setServerAuth,
    setClientAuth,
  };
}

test("client overlay navigations use the already-authenticated live client", async () => {
  getToken.mockReset();
  const ctx = authContext();

  expect(await authenticateManagerOverlaySsr(ctx.context as never)).toBeNull();
  expect(getToken).not.toHaveBeenCalled();
  expect(ctx.setServerAuth).not.toHaveBeenCalled();
});

test("direct manager-overlay SSR authenticates both Convex clients", async () => {
  await using _window = withoutBrowserWindowResource();
  getToken.mockReset();
  getToken.mockResolvedValueOnce("manager-token");
  const ctx = authContext();

  expect(await authenticateManagerOverlaySsr(ctx.context as never)).toBe("manager-token");
  expect(ctx.setServerAuth).toHaveBeenCalledWith("manager-token");
  expect(ctx.setClientAuth).toHaveBeenCalledOnce();
  expect(await ctx.setClientAuth.mock.calls[0]?.[0]()).toBe("manager-token");
});

test("anonymous manager-overlay SSR stays unauthenticated", async () => {
  await using _window = withoutBrowserWindowResource();
  getToken.mockReset();
  getToken.mockResolvedValueOnce(null);
  const ctx = authContext();

  expect(await authenticateManagerOverlaySsr(ctx.context as never)).toBeNull();
  expect(ctx.setServerAuth).not.toHaveBeenCalled();
  expect(ctx.setClientAuth).not.toHaveBeenCalled();
});
