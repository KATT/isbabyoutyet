import { expect, test, vi } from "vitest";
import { makeResource } from "./test.resource";
import { sendPasswordResetEmail } from "./cloudflareEmail";

function cloudflareEmailEnvironment() {
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-id");
  vi.stubEnv("CLOUDFLARE_EMAIL_API_TOKEN", "email-token");
  vi.stubEnv("EMAIL_FROM", "account@isbabyoutyet.com");
  return makeResource({}, () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
}

test("sends password reset email through Cloudflare Email Service", async () => {
  await using _environment = cloudflareEmailEnvironment();
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  await sendPasswordResetEmail({
    recipient: "parent@example.com",
    resetUrl: "https://isbabyoutyet.com/auth/reset-password?token=secret",
  });

  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  expect(url).toBe(
    "https://api.cloudflare.com/client/v4/accounts/account-id/email/sending/send",
  );
  expect(init?.headers).toEqual({
    Authorization: "Bearer email-token",
    "Content-Type": "application/json",
  });
  expect(JSON.parse(String(init?.body))).toMatchObject({
    to: "parent@example.com",
    from: "account@isbabyoutyet.com",
    subject: "Reset your Is Baby Out Yet? password",
  });
});

test("fails when Cloudflare rejects the email", async () => {
  await using _environment = cloudflareEmailEnvironment();
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 })),
  );

  await expect(
    sendPasswordResetEmail({
      recipient: "parent@example.com",
      resetUrl: "https://isbabyoutyet.com/auth/reset-password?token=secret",
    }),
  ).rejects.toThrow("Cloudflare Email Service rejected the message (403)");
});

test("fails before sending when Email Service is not configured", async () => {
  await using _environment = makeResource({}, () => {
    vi.unstubAllGlobals();
  });
  vi.stubGlobal("fetch", vi.fn<typeof fetch>());

  await expect(
    sendPasswordResetEmail({
      recipient: "parent@example.com",
      resetUrl: "https://isbabyoutyet.com/auth/reset-password?token=secret",
    }),
  ).rejects.toThrow("CLOUDFLARE_ACCOUNT_ID is not configured");
  expect(fetch).not.toHaveBeenCalled();
});
