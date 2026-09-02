import { createElement } from "react";
import { render } from "react-email";
import { passwordResetCopy, verifyEmailCopy } from "./copy";
import { PasswordResetEmail } from "./password-reset";
import { VerifyEmail } from "./verify-email";

export type RenderPasswordResetEmailInput = {
  resetUrl: string;
  subjectPrefix: string;
};

export type RenderVerifyEmailInput = {
  subjectPrefix: string;
  verifyUrl: string;
};

export type RenderedEmail = {
  html: string;
  subject: string;
  text: string;
};

function emailText(opts: { button: string; ignore: string; intro: string; url: string }) {
  return [opts.intro, "", `${opts.button}: ${opts.url}`, "", opts.ignore].join("\n");
}

/**
 * Render the password-reset template to HTML + plaintext. Convex stays on
 * `.ts` and calls this instead of importing JSX.
 */
export async function renderPasswordResetEmail(
  input: RenderPasswordResetEmailInput,
): Promise<RenderedEmail> {
  const html = await render(
    createElement(PasswordResetEmail, {
      resetUrl: input.resetUrl,
      subjectPrefix: input.subjectPrefix,
    }),
  );

  return {
    html,
    subject: `${input.subjectPrefix}${passwordResetCopy.subject}`,
    text: emailText({
      button: passwordResetCopy.button,
      ignore: passwordResetCopy.ignore,
      intro: passwordResetCopy.intro,
      url: input.resetUrl,
    }),
  };
}

/**
 * Render verify-email and change-email confirmation mail. Better Auth sends
 * this to the address being confirmed (current, or the new one on change).
 */
export async function renderVerifyEmail(input: RenderVerifyEmailInput): Promise<RenderedEmail> {
  const html = await render(
    createElement(VerifyEmail, {
      subjectPrefix: input.subjectPrefix,
      verifyUrl: input.verifyUrl,
    }),
  );

  return {
    html,
    subject: `${input.subjectPrefix}${verifyEmailCopy.subject}`,
    text: emailText({
      button: verifyEmailCopy.button,
      ignore: verifyEmailCopy.ignore,
      intro: verifyEmailCopy.intro,
      url: input.verifyUrl,
    }),
  };
}
