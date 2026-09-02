import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { createAuth, resolveAuthBaseUrl, sendAuthResetPassword } from "./auth";
import schema from "./schema";
import { makeResource } from "./test.resource";
import { modules, registerComponents } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  return t;
}

function withoutVercelEnv() {
  const previousVercelEnv = process.env.VERCEL_ENV;
  delete process.env.VERCEL_ENV;
  return makeResource({}, () => {
    if (previousVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = previousVercelEnv;
    }
  });
}

test("auth base URL prefers the web origin after preview env sync", () => {
  expect(resolveAuthBaseUrl("https://preview.example", "https://convex.example")).toBe(
    "https://preview.example",
  );
});

test("auth base URL falls back to the Convex origin during preview bootstrap", () => {
  expect(resolveAuthBaseUrl(undefined, "https://convex.example")).toBe("https://convex.example");
});

test("sendAuthResetPassword rejects query and mutation contexts", async () => {
  const t = await setup();
  await expect(
    t.run(async (ctx) => {
      await sendAuthResetPassword(ctx, {
        url: "https://isbabyoutyet.com/auth/reset-password?token=abc",
        user: { email: "parent@example.com" },
      });
    }),
  ).rejects.toThrow("Action context required");
});

test("sendAuthResetPassword delivers through Convex env from an action ctx", async () => {
  await using _env = withoutVercelEnv();
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  await using _restore = makeResource({}, () => {
    log.mockRestore();
  });

  const t = await setup();
  await t.action(async (ctx) => {
    await sendAuthResetPassword(ctx, {
      url: "https://isbabyoutyet.com/auth/reset-password?token=abc",
      user: { email: "parent@example.com" },
    });
  });

  expect(log).toHaveBeenCalledWith(
    "email.skipped_local_delivery",
    expect.objectContaining({
      to: "parent@example.com",
    }),
  );
});

test("createAuth sendResetPassword uses the action-only delivery helper", async () => {
  await using _env = withoutVercelEnv();
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  await using _restore = makeResource({}, () => {
    log.mockRestore();
  });

  const t = await setup();
  await t.action(async (ctx) => {
    const auth = createAuth(ctx);
    const sendResetPassword = auth.options.emailAndPassword?.sendResetPassword;
    if (sendResetPassword === undefined) {
      throw new Error("expected sendResetPassword");
    }

    await sendResetPassword({
      token: "abc",
      url: "https://isbabyoutyet.com/auth/reset-password?token=abc",
      user: {
        createdAt: new Date(0),
        email: "parent@example.com",
        emailVerified: false,
        id: "user_1",
        name: "Parent",
        updatedAt: new Date(0),
      },
    });
  });

  expect(log).toHaveBeenCalledWith(
    "email.skipped_local_delivery",
    expect.objectContaining({
      to: "parent@example.com",
    }),
  );
});
