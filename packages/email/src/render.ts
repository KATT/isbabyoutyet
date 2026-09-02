import { createElement } from "react";
import { render } from "react-email";
import { passwordResetCopy } from "./copy";
import { PasswordResetEmail } from "./password-reset";

export type RenderPasswordResetEmailInput = {
  resetUrl: string;
  subjectPrefix: string;
};

export type RenderedEmail = {
  html: string;
  subject: string;
  text: string;
};

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
    text: [
      passwordResetCopy.intro,
      "",
      `${passwordResetCopy.button}: ${input.resetUrl}`,
      "",
      passwordResetCopy.ignore,
    ].join("\n"),
  };
}
