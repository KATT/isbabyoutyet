import { fireEvent, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { LocaleProvider } from "@/lib/i18n";
import {
  ForgotPasswordCard,
  Route as ForgotPasswordRoute,
  forgotPasswordAuthAdapter,
  requestPasswordResetAndMarkSent,
} from "@/routes/auth/forgot-password";
import {
  ResetPasswordCard,
  Route as ResetPasswordRoute,
  resetPasswordAndRedirect,
  resetPasswordAuthAdapter,
} from "@/routes/auth/reset-password";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import { renderMountedFileRoute } from "@/test/renderMountedFileRoute";
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

test.each([
  { errorMessage: "Too many requests", expectedMessage: "Too many requests" },
  { errorMessage: "", expectedMessage: "Unable to request a password reset" },
])("forgot password throws $expectedMessage and never marks sent", async (testCase) => {
  const requestReset = vi
    .fn<() => Promise<{ errorMessage: string | null }>>()
    .mockResolvedValue({ errorMessage: testCase.errorMessage });
  const markSent = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  await expect(
    requestPasswordResetAndMarkSent(
      { email: "parent@example.com" },
      {
        failedMessage: "Unable to request a password reset",
        markSent,
        requestReset,
        resetRedirectTo: "https://isbabyoutyet.com/auth/reset-password",
      },
    ),
  ).rejects.toThrow(testCase.expectedMessage);
  expect(markSent).not.toHaveBeenCalled();
});

test.each([
  { errorMessage: "Invalid token", expectedMessage: "Invalid token" },
  { errorMessage: "", expectedMessage: "Unable to reset your password" },
])("reset password throws $expectedMessage and never navigates", async (testCase) => {
  const resetPassword = vi
    .fn<() => Promise<{ errorMessage: string | null }>>()
    .mockResolvedValue({ errorMessage: testCase.errorMessage });
  const navigateToLogin = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  await expect(
    resetPasswordAndRedirect(
      { confirmPassword: "new-password", password: "new-password" },
      {
        failedMessage: "Unable to reset your password",
        navigateToLogin,
        resetPassword,
        token: "reset-token",
      },
    ),
  ).rejects.toThrow(testCase.expectedMessage);
  expect(navigateToLogin).not.toHaveBeenCalled();
});

test("forgot password card validates the email before submitting", async () => {
  const onRequestReset = vi.fn(async () => {});
  await using _view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <ForgotPasswordCard onRequestReset={onRequestReset} sent={false} />
    </LocaleProvider>,
    { path: "/auth/forgot-password" },
  );

  const email = htmlInput(screen.getByLabelText("Email"));
  fireEvent.change(email, {
    target: { value: "not-an-email" },
  });
  const form = email.form;
  if (!form) {
    throw new Error("expected forgot-password form");
  }
  // Native `type="email"` blocks the click path; submit the form so Zod runs.
  fireEvent.submit(form);

  await vi.waitFor(() => {
    expect(screen.getByText("Invalid email address")).toBeTruthy();
  });
  expect(onRequestReset).not.toHaveBeenCalled();
});

test("reset password card validates length and matching passwords", async () => {
  const onResetPassword = vi.fn(async () => {});
  await using _view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <ResetPasswordCard invalidLink={false} onResetPassword={onResetPassword} />
    </LocaleProvider>,
    { path: "/auth/reset-password" },
  );

  fireEvent.change(htmlInput(screen.getByLabelText("New password")), {
    target: { value: "short" },
  });
  fireEvent.change(htmlInput(screen.getByLabelText("Confirm new password")), {
    target: { value: "short" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));

  await vi.waitFor(() => {
    expect(screen.getByText("Password must be at least 8 characters")).toBeTruthy();
  });
  expect(onResetPassword).not.toHaveBeenCalled();

  fireEvent.change(htmlInput(screen.getByLabelText("New password")), {
    target: { value: "new-password" },
  });
  fireEvent.change(htmlInput(screen.getByLabelText("Confirm new password")), {
    target: { value: "other-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));

  await vi.waitFor(() => {
    expect(screen.getByText("Passwords do not match")).toBeTruthy();
  });
  expect(onResetPassword).not.toHaveBeenCalled();
});

test("forgot-password route head sets the document title", () => {
  // @ts-expect-error — stub match is the locale head reads
  const head: (opts: { match: { context: { locale: "en-GB" } } }) => {
    meta: Array<{ title: string | undefined }>;
  } = ForgotPasswordRoute.options.head;
  const result = head({ match: { context: { locale: "en-GB" } } });
  expect(result.meta.some((entry) => entry.title?.includes("Reset your password"))).toBe(true);
});

test("reset-password route head sets the document title", () => {
  // @ts-expect-error — stub match is the locale head reads
  const head: (opts: { match: { context: { locale: "en-GB" } } }) => {
    meta: Array<{ title: string | undefined }>;
  } = ResetPasswordRoute.options.head;
  const result = head({ match: { context: { locale: "en-GB" } } });
  expect(result.meta.some((entry) => entry.title?.includes("Choose a new password"))).toBe(true);
});

test("ForgotPasswordPage wires the real auth client into ForgotPasswordCard", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: "/auth/forgot-password",
    overlayHistory: null,
    path: "/auth/forgot-password",
    route: ForgotPasswordRoute,
    wrap: null,
  });

  expect(ctx.view.getByLabelText("Email")).toBeTruthy();
  expect(ctx.view.getByRole("button", { name: "Send reset link" })).toBeTruthy();
});

test("ForgotPasswordPage shows the sent confirmation from the URL", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: "/auth/forgot-password?sent=1",
    overlayHistory: null,
    path: "/auth/forgot-password",
    route: ForgotPasswordRoute,
    wrap: null,
  });

  expect(
    ctx.view.getByText(
      "If an account exists for that address, a password reset email is on its way.",
    ),
  ).toBeTruthy();
});

test("ForgotPasswordPage request path invokes the wired auth client", async () => {
  const requestPasswordReset = vi.fn().mockResolvedValue({ data: null, error: null });
  const original = forgotPasswordAuthAdapter.requestPasswordReset;
  // SAFETY: Test stub replaces the adapter's network-backed Better Auth method.
  forgotPasswordAuthAdapter.requestPasswordReset =
    requestPasswordReset as typeof forgotPasswordAuthAdapter.requestPasswordReset;
  await using _adapter = makeResource({}, () => {
    forgotPasswordAuthAdapter.requestPasswordReset = original;
  });

  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: "/auth/forgot-password",
    overlayHistory: null,
    path: "/auth/forgot-password",
    route: ForgotPasswordRoute,
    wrap: null,
  });

  fireEvent.change(htmlInput(ctx.view.getByLabelText("Email")), {
    target: { value: "parent@example.com" },
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Send reset link" }));

  await vi.waitFor(() => {
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "parent@example.com",
      redirectTo: expect.stringContaining("/auth/reset-password"),
    });
  });
  await vi.waitFor(() => {
    expect(ctx.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        replace: true,
        search: { sent: "1" },
        to: "/auth/forgot-password",
      }),
    );
  });
});

test("ResetPasswordPage offers another link when the token is missing", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: "/auth/reset-password",
    overlayHistory: null,
    path: "/auth/reset-password",
    route: ResetPasswordRoute,
    wrap: null,
  });

  expect(ctx.view.getByText("This reset link is invalid or has expired.")).toBeTruthy();
  expect(ctx.view.getByRole("link", { name: "Request another link" })).toBeTruthy();
});

test("ResetPasswordPage treats INVALID_TOKEN as an expired link", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: "/auth/reset-password?error=INVALID_TOKEN",
    overlayHistory: null,
    path: "/auth/reset-password",
    route: ResetPasswordRoute,
    wrap: null,
  });

  expect(ctx.view.getByText("This reset link is invalid or has expired.")).toBeTruthy();
});

test("ResetPasswordPage reset path invokes the wired auth client", async () => {
  const resetPassword = vi.fn().mockResolvedValue({ data: null, error: null });
  const original = resetPasswordAuthAdapter.resetPassword;
  // SAFETY: Test stub replaces the adapter's network-backed Better Auth method.
  resetPasswordAuthAdapter.resetPassword =
    resetPassword as typeof resetPasswordAuthAdapter.resetPassword;
  await using _adapter = makeResource({}, () => {
    resetPasswordAuthAdapter.resetPassword = original;
  });

  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: "/auth/reset-password?token=reset-token",
    overlayHistory: null,
    path: "/auth/reset-password",
    route: ResetPasswordRoute,
    wrap: null,
  });

  fireEvent.change(htmlInput(ctx.view.getByLabelText("New password")), {
    target: { value: "new-password" },
  });
  fireEvent.change(htmlInput(ctx.view.getByLabelText("Confirm new password")), {
    target: { value: "new-password" },
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Update password" }));

  await vi.waitFor(() => {
    expect(resetPassword).toHaveBeenCalledWith({
      newPassword: "new-password",
      token: "reset-token",
    });
  });
  await vi.waitFor(() => {
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/auth/login" });
  });
});

test("ForgotPasswordPage surfaces an empty Better Auth error as the failed message", async () => {
  const requestPasswordReset = vi.fn().mockResolvedValue({
    data: null,
    error: { message: undefined },
  });
  const original = forgotPasswordAuthAdapter.requestPasswordReset;
  // SAFETY: Test stub replaces the adapter's network-backed Better Auth method.
  forgotPasswordAuthAdapter.requestPasswordReset =
    requestPasswordReset as typeof forgotPasswordAuthAdapter.requestPasswordReset;
  await using _adapter = makeResource({}, () => {
    forgotPasswordAuthAdapter.requestPasswordReset = original;
  });

  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: "/auth/forgot-password",
    overlayHistory: null,
    path: "/auth/forgot-password",
    route: ForgotPasswordRoute,
    wrap: null,
  });

  fireEvent.change(htmlInput(ctx.view.getByLabelText("Email")), {
    target: { value: "parent@example.com" },
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Send reset link" }));

  await vi.waitFor(() => {
    expect(requestPasswordReset).toHaveBeenCalled();
  });
  expect(ctx.navigate).not.toHaveBeenCalled();
});

test("ResetPasswordPage surfaces an empty Better Auth error as the failed message", async () => {
  const resetPassword = vi.fn().mockResolvedValue({
    data: null,
    error: { message: undefined },
  });
  const original = resetPasswordAuthAdapter.resetPassword;
  // SAFETY: Test stub replaces the adapter's network-backed Better Auth method.
  resetPasswordAuthAdapter.resetPassword =
    resetPassword as typeof resetPasswordAuthAdapter.resetPassword;
  await using _adapter = makeResource({}, () => {
    resetPasswordAuthAdapter.resetPassword = original;
  });

  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: "/auth/reset-password?token=reset-token",
    overlayHistory: null,
    path: "/auth/reset-password",
    route: ResetPasswordRoute,
    wrap: null,
  });

  fireEvent.change(htmlInput(ctx.view.getByLabelText("New password")), {
    target: { value: "new-password" },
  });
  fireEvent.change(htmlInput(ctx.view.getByLabelText("Confirm new password")), {
    target: { value: "new-password" },
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Update password" }));

  await vi.waitFor(() => {
    expect(resetPassword).toHaveBeenCalled();
  });
  expect(ctx.navigate).not.toHaveBeenCalled();
});
