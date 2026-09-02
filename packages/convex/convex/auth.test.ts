import { expect, test, vi } from "vitest";
import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";
import { createAuth, resolveAuthBaseUrl, sendAuthResetPassword } from "./auth";
import { makeResource } from "./test.resource";

test("auth base URL prefers the web origin after preview env sync", () => {
  expect(resolveAuthBaseUrl("https://preview.example", "https://convex.example")).toBe(
    "https://preview.example",
  );
});

test("auth base URL falls back to the Convex origin during preview bootstrap", () => {
  expect(resolveAuthBaseUrl(undefined, "https://convex.example")).toBe("https://convex.example");
});

test("sendAuthResetPassword rejects query and mutation contexts", async () => {
  // SAFETY: requireActionCtx only checks for `runAction`; a bare object is a query-like ctx.
  const ctx = {} as GenericCtx<DataModel>;
  await expect(
    sendAuthResetPassword(ctx, {
      url: "https://isbabyoutyet.com/auth/reset-password?token=abc",
      user: { email: "parent@example.com" },
    }),
  ).rejects.toThrow("Action context required");
});

test("sendAuthResetPassword delivers through Convex env from an action ctx", async () => {
  const previousVercelEnv = process.env.VERCEL_ENV;
  await using _env = makeResource({}, () => {
    if (previousVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = previousVercelEnv;
    }
  });
  delete process.env.VERCEL_ENV;

  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  await using _restore = makeResource({}, () => {
    log.mockRestore();
  });

  // SAFETY: requireActionCtx only checks for `runAction`.
  const ctx = { runAction: async () => undefined } as GenericCtx<DataModel>;
  await sendAuthResetPassword(ctx, {
    url: "https://isbabyoutyet.com/auth/reset-password?token=abc",
    user: { email: "parent@example.com" },
  });

  expect(log).toHaveBeenCalledWith(
    "email.skipped_local_delivery",
    expect.objectContaining({
      to: "parent@example.com",
    }),
  );
});

test("createAuth sendResetPassword uses the action-only delivery helper", async () => {
  const previousVercelEnv = process.env.VERCEL_ENV;
  await using _env = makeResource({}, () => {
    if (previousVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = previousVercelEnv;
    }
  });
  delete process.env.VERCEL_ENV;

  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  await using _restore = makeResource({}, () => {
    log.mockRestore();
  });

  // SAFETY: Better Auth stores ctx on the adapter; sendResetPassword only needs runAction.
  const ctx = { runAction: async () => undefined } as GenericCtx<DataModel>;
  const auth = createAuth(ctx);
  const sendResetPassword = auth.options.emailAndPassword?.sendResetPassword;
  if (sendResetPassword === undefined) {
    throw new Error("expected sendResetPassword");
  }

  await sendResetPassword(
    {
      token: "abc",
      url: "https://isbabyoutyet.com/auth/reset-password?token=abc",
      user: { email: "parent@example.com" },
    },
    undefined,
  );

  expect(log).toHaveBeenCalledWith(
    "email.skipped_local_delivery",
    expect.objectContaining({
      to: "parent@example.com",
    }),
  );
});
