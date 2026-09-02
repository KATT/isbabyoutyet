import { renderPasswordResetEmail, renderVerifyEmail } from "@workspace/email";
import type { RenderedEmail } from "@workspace/email";
import {
  defaultEmailLog,
  resolveEmailIdentity,
  resolveEmailSender,
  type EmailSender,
  type EmailSenderEnv,
} from "./emailSender";
import { env } from "./_generated/server";

export type EmailDeliveryDeps = {
  readonly env: EmailSenderEnv;
  readonly fetchImpl: typeof fetch;
  readonly log: typeof defaultEmailLog;
  /** When null, resolve from env (log locally, Cloudflare on Vercel). */
  readonly sender: EmailSender | null;
};

/** @deprecated Use {@link EmailDeliveryDeps}. */
export type PasswordResetEmailDeps = EmailDeliveryDeps;

async function sendRenderedEmail(opts: {
  deps: EmailDeliveryDeps | null;
  recipient: string;
  rendered: RenderedEmail;
}) {
  const deps = opts.deps ?? defaultEmailDeliveryDeps();
  const identity = resolveEmailIdentity(deps.env);
  const sender =
    deps.sender ??
    resolveEmailSender({
      env: deps.env,
      fetchImpl: deps.fetchImpl,
      log: deps.log,
    });

  await sender.send({
    from: {
      address: identity.address,
      name: identity.name,
    },
    html: opts.rendered.html,
    subject: opts.rendered.subject,
    text: opts.rendered.text,
    to: opts.recipient,
  });
}

/**
 * Build the password-reset template and deliver it through the resolved
 * {@link EmailSender}. Production passes `deps: null`; tests inject env /
 * fetch / sender.
 */
export async function sendPasswordResetEmail(opts: {
  deps: EmailDeliveryDeps | null;
  recipient: string;
  resetUrl: string;
}) {
  const deps = opts.deps ?? defaultEmailDeliveryDeps();
  const identity = resolveEmailIdentity(deps.env);
  await sendRenderedEmail({
    deps,
    recipient: opts.recipient,
    rendered: await renderPasswordResetEmail({
      resetUrl: opts.resetUrl,
      subjectPrefix: identity.subjectPrefix,
    }),
  });
}

/**
 * Verify-email and change-email confirmation (Better Auth sends this to the
 * address being confirmed).
 */
export async function sendVerificationEmail(opts: {
  deps: EmailDeliveryDeps | null;
  recipient: string;
  verifyUrl: string;
}) {
  const deps = opts.deps ?? defaultEmailDeliveryDeps();
  const identity = resolveEmailIdentity(deps.env);
  await sendRenderedEmail({
    deps,
    recipient: opts.recipient,
    rendered: await renderVerifyEmail({
      subjectPrefix: identity.subjectPrefix,
      verifyUrl: opts.verifyUrl,
    }),
  });
}

function defaultEmailDeliveryDeps(): EmailDeliveryDeps {
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
