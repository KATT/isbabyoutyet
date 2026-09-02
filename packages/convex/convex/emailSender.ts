/**
 * Email delivery port + adapters.
 *
 * Better Auth (and future transactional mail) depend on {@link EmailSender}
 * rather than Cloudflare or `console` directly. Local backends always log;
 * Vercel production/preview use Cloudflare Email Service when configured.
 */

const EMAIL_API_ORIGIN = "https://api.cloudflare.com/client/v4";

export const DEFAULT_PRODUCTION_FROM_EMAIL = "noreply@isbabyoutyet.com";
export const DEFAULT_PREVIEW_FROM_EMAIL = "preview@isbabyoutyet.com";
export const PRODUCTION_FROM_NAME = "Is Baby Out Yet?";
export const PREVIEW_FROM_NAME = "Is Baby Out Yet? (Preview)";
export const PREVIEW_SUBJECT_PREFIX = "[Preview] ";

export type EmailAddress = {
  readonly address: string;
  readonly name: string;
};

export type EmailMessage = {
  readonly from: EmailAddress;
  readonly html: string;
  readonly subject: string;
  readonly text: string;
  readonly to: string;
};

export type EmailSender = {
  readonly kind: "cloudflare" | "log";
  send(message: EmailMessage): Promise<void>;
};

export type EmailSenderEnv = {
  readonly CLOUDFLARE_ACCOUNT_ID: string | undefined;
  readonly CLOUDFLARE_EMAIL_API_TOKEN: string | undefined;
  readonly EMAIL_FROM: string | undefined;
  readonly EMAIL_FROM_PREVIEW: string | undefined;
  readonly VERCEL_ENV: "production" | "preview" | undefined;
};

export type CloudflareEmailSenderOptions = {
  readonly accountId: string;
  readonly apiToken: string;
  readonly fetchImpl: typeof fetch;
};

export type ResolveEmailSenderOptions = {
  readonly env: EmailSenderEnv;
  readonly fetchImpl: typeof fetch;
  readonly log: (message: string, details: EmailMessage) => void;
};

export function createLogEmailSender(
  log: (message: string, details: EmailMessage) => void,
): EmailSender {
  return {
    kind: "log",
    async send(message) {
      log("email.skipped_local_delivery", message);
    },
  };
}

export function createCloudflareEmailSender(opts: CloudflareEmailSenderOptions): EmailSender {
  return {
    kind: "cloudflare",
    async send(message) {
      const response = await opts.fetchImpl(
        `${EMAIL_API_ORIGIN}/accounts/${encodeURIComponent(opts.accountId)}/email/sending/send`,
        {
          body: JSON.stringify({
            from: {
              address: message.from.address,
              name: message.from.name,
            },
            html: message.html,
            subject: message.subject,
            text: message.text,
            to: message.to,
          }),
          headers: {
            Authorization: `Bearer ${opts.apiToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(`Cloudflare Email Service rejected the message (${response.status})`);
      }
    },
  };
}

export function resolveEmailIdentity(env: EmailSenderEnv): EmailAddress & {
  readonly subjectPrefix: string;
} {
  if (env.VERCEL_ENV === "preview") {
    return {
      address: env.EMAIL_FROM_PREVIEW ?? DEFAULT_PREVIEW_FROM_EMAIL,
      name: PREVIEW_FROM_NAME,
      subjectPrefix: PREVIEW_SUBJECT_PREFIX,
    };
  }

  return {
    address: env.EMAIL_FROM ?? DEFAULT_PRODUCTION_FROM_EMAIL,
    name: PRODUCTION_FROM_NAME,
    subjectPrefix: "",
  };
}

/**
 * Local Convex backends always log. Production and preview send through
 * Cloudflare when the Email Service credentials are present; otherwise the
 * sender throws a clear setup error when `send` is called.
 */
export function resolveEmailSender(opts: ResolveEmailSenderOptions): EmailSender {
  const vercelEnv = opts.env.VERCEL_ENV;
  if (vercelEnv !== "production" && vercelEnv !== "preview") {
    return createLogEmailSender(opts.log);
  }

  const accountId = opts.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = opts.env.CLOUDFLARE_EMAIL_API_TOKEN;
  if (!accountId || !apiToken) {
    return {
      kind: "cloudflare",
      async send() {
        throw new Error(
          "Cloudflare Email Service is not configured (set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN on Vercel Preview/Production).",
        );
      },
    };
  }

  return createCloudflareEmailSender({
    accountId,
    apiToken,
    fetchImpl: opts.fetchImpl,
  });
}

export function defaultEmailLog(message: string, details: EmailMessage) {
  console.log(message, {
    from: details.from,
    subject: details.subject,
    text: details.text,
    to: details.to,
  });
}
