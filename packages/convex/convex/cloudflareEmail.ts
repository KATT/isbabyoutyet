import { renderPasswordResetEmail } from "@workspace/email";
import {
  defaultEmailLog,
  resolveEmailIdentity,
  resolveEmailSender,
  type EmailSender,
  type EmailSenderEnv,
} from "./emailSender";
import { env } from "./_generated/server";

export type PasswordResetEmailDeps = {
  readonly env: EmailSenderEnv;
  readonly fetchImpl: typeof fetch;
  readonly log: typeof defaultEmailLog;
  /** When null, resolve from env (log locally, Cloudflare on Vercel). */
  readonly sender: EmailSender | null;
};

/**
 * Build the password-reset template and deliver it through the resolved
 * {@link EmailSender}. Production passes `deps: null`; tests inject env /
 * fetch / sender.
 */
export async function sendPasswordResetEmail(opts: {
  deps: PasswordResetEmailDeps | null;
  recipient: string;
  resetUrl: string;
}) {
  const deps = opts.deps ?? defaultPasswordResetEmailDeps();
  const identity = resolveEmailIdentity(deps.env);
  const sender =
    deps.sender ??
    resolveEmailSender({
      env: deps.env,
      fetchImpl: deps.fetchImpl,
      log: deps.log,
    });

  const rendered = await renderPasswordResetEmail({
    resetUrl: opts.resetUrl,
    subjectPrefix: identity.subjectPrefix,
  });

  await sender.send({
    from: {
      address: identity.address,
      name: identity.name,
    },
    html: rendered.html,
    subject: rendered.subject,
    text: rendered.text,
    to: opts.recipient,
  });
}

function defaultPasswordResetEmailDeps(): PasswordResetEmailDeps {
  return {
    env: {
      CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_EMAIL_API_TOKEN: env.CLOUDFLARE_EMAIL_API_TOKEN,
      EMAIL_FROM: env.EMAIL_FROM,
      EMAIL_FROM_PREVIEW: env.EMAIL_FROM_PREVIEW,
      VERCEL_ENV: env.VERCEL_ENV,
    },
    fetchImpl: fetch,
    log: defaultEmailLog,
    sender: null,
  };
}
