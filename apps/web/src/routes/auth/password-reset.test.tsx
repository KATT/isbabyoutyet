import { fireEvent, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import { ForgotPasswordCard, requestPasswordResetAndMarkSent } from "@/routes/auth/forgot-password";
import { ResetPasswordCard, resetPasswordAndRedirect } from "@/routes/auth/reset-password";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { htmlInput } from "@/test/htmlElement";

test("forgot password requests a reset then marks the page as sent", async () => {
  const requestReset = vi
    .fn<() => Promise<{ errorMessage: string | null }>>()
    .mockResolvedValue({ errorMessage: null });
  const markSent = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  await requestPasswordResetAndMarkSent(
    { email: "parent@example.com" },
    {
      failedMessage: "Unable to request a password reset",
      markSent,
      requestReset,
      resetRedirectTo: "https://isbabyoutyet.com/auth/reset-password",
    },
  );

  expect(requestReset).toHaveBeenCalledWith({
    email: "parent@example.com",
    redirectTo: "https://isbabyoutyet.com/auth/reset-password",
  });
  expect(markSent).toHaveBeenCalledTimes(1);
});

test("forgot password card shows the sent confirmation from the URL", async () => {
  await using _view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <ForgotPasswordCard onRequestReset={vi.fn()} sent />
    </LocaleProvider>,
    { path: "/auth/forgot-password" },
  );

  expect(
    screen.getByText(
      "If an account exists for that address, a password reset email is on its way.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to sign in" })).toBeTruthy();
});

test("forgot password card submits the email through the injected handler", async () => {
  const onRequestReset = vi.fn(async () => {});
  await using _view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <ForgotPasswordCard onRequestReset={onRequestReset} sent={false} />
    </LocaleProvider>,
    { path: "/auth/forgot-password" },
  );

  fireEvent.change(htmlInput(screen.getByLabelText("Email")), {
    target: { value: "parent@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

  await vi.waitFor(() => {
    expect(onRequestReset).toHaveBeenCalledWith({ email: "parent@example.com" });
  });
});

test("reset password updates the password then navigates to login", async () => {
  const resetPassword = vi
    .fn<() => Promise<{ errorMessage: string | null }>>()
    .mockResolvedValue({ errorMessage: null });
  const navigateToLogin = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  await resetPasswordAndRedirect(
    { confirmPassword: "new-password", password: "new-password" },
    {
      failedMessage: "Unable to reset your password",
      navigateToLogin,
      resetPassword,
      token: "reset-token",
    },
  );

  expect(resetPassword).toHaveBeenCalledWith({
    newPassword: "new-password",
    token: "reset-token",
  });
  expect(navigateToLogin).toHaveBeenCalledTimes(1);
});

test("reset password card offers another link when the token is invalid", async () => {
  await using _view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <ResetPasswordCard invalidLink onResetPassword={null} />
    </LocaleProvider>,
    { path: "/auth/reset-password" },
  );

  expect(screen.getByText("This reset link is invalid or has expired.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Request another link" })).toBeTruthy();
});

test("reset password card submits matching passwords", async () => {
  const onResetPassword = vi.fn(async () => {});
  await using _view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <ResetPasswordCard invalidLink={false} onResetPassword={onResetPassword} />
    </LocaleProvider>,
    { path: "/auth/reset-password" },
  );

  fireEvent.change(htmlInput(screen.getByLabelText("New password")), {
    target: { value: "new-password" },
  });
  fireEvent.change(htmlInput(screen.getByLabelText("Confirm new password")), {
    target: { value: "new-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));

  await vi.waitFor(() => {
    expect(onResetPassword).toHaveBeenCalledWith({
      confirmPassword: "new-password",
      password: "new-password",
    });
  });
});
