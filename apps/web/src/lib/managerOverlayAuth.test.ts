import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { authenticateManagerOverlaySsrWithToken } from "@/lib/managerOverlayAuth";

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
  const ctx = authContext();
  const fetchToken = vi.fn<() => Promise<string | null>>();

  expect(
    // @ts-expect-error — stand-in only implements the Convex auth methods this reads
    await authenticateManagerOverlaySsrWithToken({ context: ctx.context, fetchToken }),
  ).toBeNull();
  expect(fetchToken).not.toHaveBeenCalled();
  expect(ctx.setServerAuth).not.toHaveBeenCalled();
});

test("direct manager-overlay SSR authenticates both Convex clients", async () => {
  await using _window = withoutBrowserWindowResource();
  const ctx = authContext();
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValue("manager-token");

  expect(
    // @ts-expect-error — stand-in only implements the Convex auth methods this reads
    await authenticateManagerOverlaySsrWithToken({ context: ctx.context, fetchToken }),
  ).toBe("manager-token");
  expect(ctx.setServerAuth).toHaveBeenCalledWith("manager-token");
  expect(ctx.setClientAuth).toHaveBeenCalledOnce();
  expect(await ctx.setClientAuth.mock.calls[0]?.[0]()).toBe("manager-token");
});

test("anonymous manager-overlay SSR stays unauthenticated", async () => {
  await using _window = withoutBrowserWindowResource();
  const ctx = authContext();
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);

  expect(
    // @ts-expect-error — stand-in only implements the Convex auth methods this reads
    await authenticateManagerOverlaySsrWithToken({ context: ctx.context, fetchToken }),
  ).toBeNull();
  expect(ctx.setServerAuth).not.toHaveBeenCalled();
  expect(ctx.setClientAuth).not.toHaveBeenCalled();
});
