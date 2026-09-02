import { expect, test } from "vitest";
import { passwordResetCopy, verifyEmailCopy } from "./copy";
import { renderPasswordResetEmail, renderVerifyEmail } from "./render";

const resetUrl = "https://isbabyoutyet.com/auth/reset-password?token=secret";

test("password reset template includes the reset link in text and html", async () => {
  const message = await renderPasswordResetEmail({
    resetUrl,
    subjectPrefix: "",
  });

  expect(message.subject).toBe(passwordResetCopy.subject);
  expect(message.text).toContain(`Reset your password: ${resetUrl}`);
  expect(message.html).toContain(`href="${resetUrl}"`);
  expect(message.html).toContain(passwordResetCopy.heading);
  expect(message.html).toContain(passwordResetCopy.wordmark);
});

test("preview prefix appears on the subject and in a banner", async () => {
  const message = await renderPasswordResetEmail({
    resetUrl,
    subjectPrefix: "[Preview] ",
  });

  expect(message.subject).toBe(`[Preview] ${passwordResetCopy.subject}`);
  expect(message.html).toContain(passwordResetCopy.previewBanner);
});

test("production html omits the preview banner", async () => {
  const message = await renderPasswordResetEmail({
    resetUrl,
    subjectPrefix: "",
  });

  expect(message.html).not.toContain(passwordResetCopy.previewBanner);
});

test("password reset html escapes special characters in the reset url", async () => {
  const hostileUrl = `https://isbabyoutyet.com/auth/reset-password?token=a&next="x"'<y>`;
  const message = await renderPasswordResetEmail({
    resetUrl: hostileUrl,
    subjectPrefix: "",
  });

  expect(message.html).toContain("https://isbabyoutyet.com/auth/reset-password?token=a&amp;next=");
  expect(message.html).not.toContain(`href="${hostileUrl}"`);
  expect(message.text).toContain(hostileUrl);
});

const verifyUrl = "https://isbabyoutyet.com/api/auth/verify-email?token=secret";

test("verify-email template includes the confirmation link", async () => {
  const message = await renderVerifyEmail({
    subjectPrefix: "",
    verifyUrl,
  });

  expect(message.subject).toBe(verifyEmailCopy.subject);
  expect(message.text).toContain(`${verifyEmailCopy.button}: ${verifyUrl}`);
  expect(message.html).toContain(`href="${verifyUrl}"`);
  expect(message.html).toContain(verifyEmailCopy.heading);
});
