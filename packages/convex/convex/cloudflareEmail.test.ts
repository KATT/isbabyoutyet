import { expect, test, vi } from "vitest";
import { makeResource } from "./test.resource";
import { sendPasswordResetEmail, sendVerificationEmail } from "./cloudflareEmail";
import {
  DEFAULT_PREVIEW_FROM_EMAIL,
  DEFAULT_PRODUCTION_FROM_EMAIL,
  PREVIEW_SUBJECT_PREFIX,
  PRODUCTION_FROM_NAME,
  createLogEmailSender,
  defaultEmailLog,
  resolveEmailIdentity,
  resolveEmailSender,
  type EmailSenderEnv,
} from "./emailSender";
function cloudflareConfiguredEnv(overrides: Partial<EmailSenderEnv> = {}): EmailSenderEnv {
  return {
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    CLOUDFLARE_EMAIL_API_TOKEN: "email-token",
    EMAIL_FROM: undefined,
    EMAIL_FROM_PREVIEW: undefined,
    VERCEL_ENV: "production",
    ...overrides,
  };
}

test("preview identity uses a distinct from address and subject prefix", () => {
  expect(resolveEmailIdentity(cloudflareConfiguredEnv({ VERCEL_ENV: "preview" }))).toEqual({
    address: DEFAULT_PREVIEW_FROM_EMAIL,
    name: "Is Baby Out Yet? (Preview)",
    subjectPrefix: PREVIEW_SUBJECT_PREFIX,
  });
});

test("production identity uses the production from address", () => {
  expect(resolveEmailIdentity(cloudflareConfiguredEnv())).toEqual({
    address: DEFAULT_PRODUCTION_FROM_EMAIL,
    name: PRODUCTION_FROM_NAME,
    subjectPrefix: "",
  });
});

test("from-address env overrides win over the defaults", () => {
  expect(
    resolveEmailIdentity(
      cloudflareConfiguredEnv({
        EMAIL_FROM: "custom@isbabyoutyet.com",
      }),
    ),
  ).toMatchObject({ address: "custom@isbabyoutyet.com" });
  expect(
    resolveEmailIdentity(
      cloudflareConfiguredEnv({
        EMAIL_FROM_PREVIEW: "qa@isbabyoutyet.com",
        VERCEL_ENV: "preview",
      }),
    ),
  ).toMatchObject({ address: "qa@isbabyoutyet.com" });
});

test("local backends resolve to the log sender", () => {
  const sender = resolveEmailSender({
    env: cloudflareConfiguredEnv({ VERCEL_ENV: undefined }),
    fetchImpl: vi.fn<typeof fetch>(),
    log: vi.fn(),
  });
  expect(sender.kind).toBe("log");
});

test("sends password reset email through Cloudflare Email Service", async () => {
  await using _cleanup = makeResource({}, () => {
    vi.unstubAllGlobals();
  });
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  await sendPasswordResetEmail({
    deps: {
      env: cloudflareConfiguredEnv(),
      fetchImpl: fetchMock,
      log: vi.fn(),
      sender: null,
    },
    recipient: "parent@example.com",
    resetUrl: "https://isbabyoutyet.com/auth/reset-password?token=secret",
  });

  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/account-id/email/sending/send");
  expect(init?.headers).toEqual({
    Authorization: "Bearer email-token",
    "Content-Type": "application/json",
  });
  expect(JSON.parse(String(init?.body))).toMatchObject({
    from: {
      address: DEFAULT_PRODUCTION_FROM_EMAIL,
      name: "Is Baby Out Yet?",
    },
    subject: "Reset your Is Baby Out Yet? password",
    to: "parent@example.com",
  });
});

test("preview sends with prefixed subject and preview from address", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));

  await sendPasswordResetEmail({
    deps: {
      env: cloudflareConfiguredEnv({ VERCEL_ENV: "preview" }),
      fetchImpl: fetchMock,
      log: vi.fn(),
      sender: null,
    },
    recipient: "parent@example.com",
    resetUrl: "https://preview.example/auth/reset-password?token=secret",
  });

  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
    from: {
      address: DEFAULT_PREVIEW_FROM_EMAIL,
      name: "Is Baby Out Yet? (Preview)",
    },
    subject: "[Preview] Reset your Is Baby Out Yet? password",
  });
});

test("fails when Cloudflare rejects the email", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 }));

  await expect(
    sendPasswordResetEmail({
      deps: {
        env: cloudflareConfiguredEnv(),
        fetchImpl: fetchMock,
        log: vi.fn(),
        sender: null,
      },
      recipient: "parent@example.com",
      resetUrl: "https://isbabyoutyet.com/auth/reset-password?token=secret",
    }),
  ).rejects.toThrow("Cloudflare Email Service rejected the message (403)");
});

test.each([
  {
    CLOUDFLARE_ACCOUNT_ID: undefined,
    CLOUDFLARE_EMAIL_API_TOKEN: undefined,
  },
  {
    CLOUDFLARE_ACCOUNT_ID: undefined,
    CLOUDFLARE_EMAIL_API_TOKEN: "email-token",
  },
  {
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    CLOUDFLARE_EMAIL_API_TOKEN: undefined,
  },
] satisfies Array<Partial<EmailSenderEnv>>)(
  "fails clearly when Email Service credentials are incomplete",
  async (overrides) => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(
      sendPasswordResetEmail({
        deps: {
          env: cloudflareConfiguredEnv(overrides),
          fetchImpl: fetchMock,
          log: vi.fn(),
          sender: null,
        },
        recipient: "parent@example.com",
        resetUrl: "https://isbabyoutyet.com/auth/reset-password?token=secret",
      }),
    ).rejects.toThrow("Cloudflare Email Service is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test("local delivery logs instead of calling Cloudflare", async () => {
  const fetchMock = vi.fn<typeof fetch>();
  const log = vi.fn();

  await sendPasswordResetEmail({
    deps: {
      env: cloudflareConfiguredEnv({ VERCEL_ENV: undefined }),
      fetchImpl: fetchMock,
      log,
      sender: createLogEmailSender(log),
    },
    recipient: "parent@example.com",
    resetUrl: "http://localhost:3000/auth/reset-password?token=secret",
  });

  expect(fetchMock).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith(
    "email.skipped_local_delivery",
    expect.objectContaining({
      subject: "Reset your Is Baby Out Yet? password",
      to: "parent@example.com",
    }),
  );
});

test("defaultEmailLog writes a structured console line", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  await using _restore = makeResource({}, () => {
    log.mockRestore();
  });

  defaultEmailLog("email.skipped_local_delivery", {
    from: { address: DEFAULT_PRODUCTION_FROM_EMAIL, name: PRODUCTION_FROM_NAME },
    html: "<p>Reset</p>",
    subject: "Reset your Is Baby Out Yet? password",
    text: "Reset your password",
    to: "parent@example.com",
  });

  expect(log).toHaveBeenCalledWith(
    "email.skipped_local_delivery",
    expect.objectContaining({
      subject: "Reset your Is Baby Out Yet? password",
      to: "parent@example.com",
    }),
  );
});

test("omitted deps read Convex env and log on local backends", async () => {
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

  await sendPasswordResetEmail({
    deps: null,
    recipient: "parent@example.com",
    resetUrl: "http://localhost:3000/auth/reset-password?token=secret",
  });

  expect(log).toHaveBeenCalledWith(
    "email.skipped_local_delivery",
    expect.objectContaining({
      to: "parent@example.com",
    }),
  );
});

test("sends verification email through Cloudflare Email Service", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));

  await sendVerificationEmail({
    deps: {
      env: cloudflareConfiguredEnv(),
      fetchImpl: fetchMock,
      log: vi.fn(),
      sender: null,
    },
    recipient: "parent@example.com",
    verifyUrl: "https://isbabyoutyet.com/dashboard/profile?notice=verified",
  });

  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
    from: {
      address: DEFAULT_PRODUCTION_FROM_EMAIL,
      name: "Is Baby Out Yet?",
    },
    subject: "Verify your Is Baby Out Yet? email",
    to: "parent@example.com",
  });
});
