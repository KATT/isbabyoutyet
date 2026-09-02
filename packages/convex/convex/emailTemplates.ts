import type { EmailAddress, EmailMessage } from "./emailSender";

export type PasswordResetEmailInput = {
  readonly from: EmailAddress;
  readonly recipient: string;
  readonly resetUrl: string;
  readonly subjectPrefix: string;
};

/**
 * Password-reset copy shared by the log and Cloudflare adapters.
 * Keep plain text and HTML in sync when editing.
 */
export function buildPasswordResetEmail(input: PasswordResetEmailInput): EmailMessage {
  const subject = `${input.subjectPrefix}Reset your Is Baby Out Yet? password`;
  const text = [
    "Someone requested a password reset for your Is Baby Out Yet? account.",
    "",
    `Reset your password: ${input.resetUrl}`,
    "",
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");

  const html = [
    "<p>Someone requested a password reset for your Is Baby Out Yet? account.</p>",
    `<p><a href="${escapeHtmlAttribute(input.resetUrl)}">Reset your password</a></p>`,
    "<p>If you did not request this, you can safely ignore this email.</p>",
  ].join("");

  return {
    from: input.from,
    html,
    subject,
    text,
    to: input.recipient,
  };
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
