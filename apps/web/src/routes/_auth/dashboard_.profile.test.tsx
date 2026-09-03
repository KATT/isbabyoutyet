import { fireEvent } from "@testing-library/react";
import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { LocaleProvider } from "@/lib/i18n";
import type { TranslationFunction } from "@/lib/i18n";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import type { ConvexTestHarness } from "@/test/convexTestHarness";
import { htmlInput } from "@/test/htmlElement";
import { renderMountedFileRoute } from "@/test/renderMountedFileRoute";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import {
  ProfilePageView,
  Route,
  completeProfileAuthAction,
  profileAuthAdapter,
  profileNoticeMessage,
  profileSessionSnapshot,
  type ProfileNotice,
  type ProfilePageHandlers,
  type ProfileSessionSnapshot,
  type ProfileUser,
} from "./dashboard_.profile";

const verifiedUser = {
  email: "ada@example.com",
  emailVerified: true,
  name: "Ada",
} satisfies ProfileUser;

const unverifiedUser = {
  email: "ada@example.com",
  emailVerified: false,
  name: "Ada",
} satisfies ProfileUser;

function renderProfile(opts: {
  notice: ProfileNotice | null;
  onChangeEmail: ProfilePageHandlers["onChangeEmail"] | null;
  onChangePassword: ProfilePageHandlers["onChangePassword"] | null;
  onSendVerification: ProfilePageHandlers["onSendVerification"] | null;
  onUpdateName: ProfilePageHandlers["onUpdateName"] | null;
  user: ProfileUser | null;
}) {
  return renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <ProfilePageView
        notice={opts.notice}
        onChangeEmail={opts.onChangeEmail}
        onChangePassword={opts.onChangePassword}
        onSendVerification={opts.onSendVerification}
        onUpdateName={opts.onUpdateName}
        user={opts.user}
      />
    </LocaleProvider>,
    { path: "/dashboard/profile" },
  );
}

function renderReadyProfile(opts: {
  notice: ProfileNotice | null;
  onChangeEmail: ProfilePageHandlers["onChangeEmail"];
  onChangePassword: ProfilePageHandlers["onChangePassword"];
  onSendVerification: ProfilePageHandlers["onSendVerification"];
  onUpdateName: ProfilePageHandlers["onUpdateName"];
  user: ProfileUser;
}) {
  return renderProfile({
    notice: opts.notice,
    onChangeEmail: opts.onChangeEmail,
    onChangePassword: opts.onChangePassword,
    onSendVerification: opts.onSendVerification,
    onUpdateName: opts.onUpdateName,
    user: opts.user,
  });
}

test("profile remains a standalone non-nested dashboard route", () => {
  expect(Route.options.component).toBeDefined();
});

test("completeProfileAuthAction throws the server message and skips success", async () => {
  const onSuccess = vi.fn(async () => {});
  await expect(
    completeProfileAuthAction(
      { errorMessage: "Nope" },
      { failedMessage: "Unable to update your name", onSuccess },
    ),
  ).rejects.toThrow("Nope");
  expect(onSuccess).not.toHaveBeenCalled();
});

test("completeProfileAuthAction uses the fallback when the server message is empty", async () => {
  const onSuccess = vi.fn(async () => {});
  await expect(
    completeProfileAuthAction(
      { errorMessage: "" },
      { failedMessage: "Unable to update your name", onSuccess },
    ),
  ).rejects.toThrow("Unable to update your name");
});

test("completeProfileAuthAction continues after a successful auth call", async () => {
  const onSuccess = vi.fn(async () => {});
  await completeProfileAuthAction({ errorMessage: null }, { failedMessage: "failed", onSuccess });
  expect(onSuccess).toHaveBeenCalledTimes(1);
});

test("profileNoticeMessage covers every notice", () => {
  // SAFETY: Identity translator used only to assert notice keys round-trip.
  const t = ((key: string) => key) as TranslationFunction;
  expect(profileNoticeMessage("name", t)).toBe("Your name has been updated.");
  expect(profileNoticeMessage("password", t)).toBe("Your password has been updated.");
  expect(profileNoticeMessage("verify-sent", t)).toBe("Check your inbox to verify this email.");
  expect(profileNoticeMessage("email-change-sent", t)).toBe(
    "Check your inbox to confirm the new address.",
  );
  expect(profileNoticeMessage("verified", t)).toBe("Your email is now verified.");
});

test("profile page shows name, password, and verified email change", async () => {
  await using view = await renderReadyProfile({
    notice: null,
    onChangeEmail: vi.fn(async () => {}),
    onChangePassword: vi.fn(async () => {}),
    onSendVerification: vi.fn(async () => {}),
    onUpdateName: vi.fn(async () => {}),
    user: verifiedUser,
  });

  expect(view.getByRole("heading", { name: "Profile" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Back to Dashboard" }).getAttribute("href")).toBe(
    "/dashboard",
  );
  expect(htmlInput(view.getByLabelText("Your name")).value).toBe("Ada");
  expect(view.getByText("ada@example.com")).toBeTruthy();
  expect(view.getByText("Your email is verified.")).toBeTruthy();
  expect(view.getByRole("button", { name: "Change email" })).toBeTruthy();
  expect(view.queryByRole("button", { name: "Send verification email" })).toBeNull();
  expect(view.getByRole("button", { name: "Update password" })).toBeTruthy();
});

test("unverified email offers verification and hides change-email", async () => {
  const onSendVerification = vi.fn(async () => {});
  await using view = await renderReadyProfile({
    notice: null,
    onChangeEmail: vi.fn(async () => {}),
    onChangePassword: vi.fn(async () => {}),
    onSendVerification,
    onUpdateName: vi.fn(async () => {}),
    user: unverifiedUser,
  });

  expect(view.getByText("Email is unverified")).toBeTruthy();
  expect(view.getByText("Verify your current email before you can change it.")).toBeTruthy();
  expect(view.queryByRole("button", { name: "Change email" })).toBeNull();
  expect(view.queryByLabelText("New email")).toBeNull();

  fireEvent.click(view.getByRole("button", { name: "Send verification email" }));
  await vi.waitFor(() => {
    expect(onSendVerification).toHaveBeenCalledTimes(1);
  });
});

test("name form submits the trimmed name", async () => {
  const onUpdateName = vi.fn(async () => {});
  await using view = await renderReadyProfile({
    notice: null,
    onChangeEmail: vi.fn(async () => {}),
    onChangePassword: vi.fn(async () => {}),
    onSendVerification: vi.fn(async () => {}),
    onUpdateName,
    user: verifiedUser,
  });

  fireEvent.change(htmlInput(view.getByLabelText("Your name")), {
    target: { value: "Ada Lovelace" },
  });
  fireEvent.click(view.getByRole("button", { name: "Save name" }));

  await vi.waitFor(() => {
    expect(onUpdateName).toHaveBeenCalledWith({ name: "Ada Lovelace" });
  });
});

test("password form requires a matching confirmation", async () => {
  const onChangePassword = vi.fn(async () => {});
  await using view = await renderReadyProfile({
    notice: null,
    onChangeEmail: vi.fn(async () => {}),
    onChangePassword,
    onSendVerification: vi.fn(async () => {}),
    onUpdateName: vi.fn(async () => {}),
    user: verifiedUser,
  });

  fireEvent.change(htmlInput(view.getByLabelText("Current password")), {
    target: { value: "old-password" },
  });
  fireEvent.change(htmlInput(view.getByLabelText("New password")), {
    target: { value: "new-password" },
  });
  fireEvent.change(htmlInput(view.getByLabelText("Confirm new password")), {
    target: { value: "mismatch" },
  });
  fireEvent.click(view.getByRole("button", { name: "Update password" }));

  await vi.waitFor(() => {
    expect(view.getByText("Passwords do not match")).toBeTruthy();
  });
  expect(onChangePassword).not.toHaveBeenCalled();
});

test("password form submits matching passwords", async () => {
  const onChangePassword = vi.fn(async () => {});
  await using view = await renderReadyProfile({
    notice: null,
    onChangeEmail: vi.fn(async () => {}),
    onChangePassword,
    onSendVerification: vi.fn(async () => {}),
    onUpdateName: vi.fn(async () => {}),
    user: verifiedUser,
  });

  fireEvent.change(htmlInput(view.getByLabelText("Current password")), {
    target: { value: "old-password" },
  });
  fireEvent.change(htmlInput(view.getByLabelText("New password")), {
    target: { value: "new-password" },
  });
  fireEvent.change(htmlInput(view.getByLabelText("Confirm new password")), {
    target: { value: "new-password" },
  });
  fireEvent.click(view.getByRole("button", { name: "Update password" }));

  await vi.waitFor(() => {
    expect(onChangePassword).toHaveBeenCalledWith({
      confirmPassword: "new-password",
      currentPassword: "old-password",
      newPassword: "new-password",
    });
  });
});

test("change-email form rejects the current address", async () => {
  const onChangeEmail = vi.fn(async () => {});
  await using view = await renderReadyProfile({
    notice: null,
    onChangeEmail,
    onChangePassword: vi.fn(async () => {}),
    onSendVerification: vi.fn(async () => {}),
    onUpdateName: vi.fn(async () => {}),
    user: verifiedUser,
  });

  fireEvent.change(htmlInput(view.getByLabelText("New email")), {
    target: { value: "ada@example.com" },
  });
  fireEvent.click(view.getByRole("button", { name: "Change email" }));

  await vi.waitFor(() => {
    expect(view.getByText("Choose a different email address.")).toBeTruthy();
  });
  expect(onChangeEmail).not.toHaveBeenCalled();
});

test("change-email form submits a new address", async () => {
  const onChangeEmail = vi.fn(async () => {});
  await using view = await renderReadyProfile({
    notice: null,
    onChangeEmail,
    onChangePassword: vi.fn(async () => {}),
    onSendVerification: vi.fn(async () => {}),
    onUpdateName: vi.fn(async () => {}),
    user: verifiedUser,
  });

  fireEvent.change(htmlInput(view.getByLabelText("New email")), {
    target: { value: "new@example.com" },
  });
  fireEvent.click(view.getByRole("button", { name: "Change email" }));

  await vi.waitFor(() => {
    expect(onChangeEmail).toHaveBeenCalledWith({ newEmail: "new@example.com" });
  });
});

test("notice from the URL is shown as a status", async () => {
  await using view = await renderReadyProfile({
    notice: "verified",
    onChangeEmail: vi.fn(async () => {}),
    onChangePassword: vi.fn(async () => {}),
    onSendVerification: vi.fn(async () => {}),
    onUpdateName: vi.fn(async () => {}),
    user: verifiedUser,
  });

  expect(view.getByRole("status").textContent).toContain("Your email is now verified.");
});

test("profile page shows a loading spinner while the session is missing", async () => {
  await using view = await renderProfile({
    notice: null,
    onChangeEmail: null,
    onChangePassword: null,
    onSendVerification: null,
    onUpdateName: null,
    user: null,
  });

  expect(view.getByText("Loading")).toBeTruthy();
  expect(view.queryByRole("button", { name: "Save name" })).toBeNull();
});

test("profile cards hide forms when handlers are null", async () => {
  await using view = await renderProfile({
    notice: null,
    onChangeEmail: null,
    onChangePassword: null,
    onSendVerification: null,
    onUpdateName: null,
    user: verifiedUser,
  });

  expect(view.queryByRole("button", { name: "Save name" })).toBeNull();
  expect(view.queryByRole("button", { name: "Change email" })).toBeNull();
  expect(view.queryByRole("button", { name: "Update password" })).toBeNull();
  expect(view.getByText("Your email is verified.")).toBeTruthy();
});

test("verified email with a null change handler hides the change-email form", async () => {
  await using view = await renderProfile({
    notice: null,
    onChangeEmail: null,
    onChangePassword: vi.fn(async () => {}),
    onSendVerification: vi.fn(async () => {}),
    onUpdateName: vi.fn(async () => {}),
    user: verifiedUser,
  });

  expect(view.getByText("Your email is verified.")).toBeTruthy();
  expect(view.queryByRole("button", { name: "Change email" })).toBeNull();
  expect(view.queryByLabelText("New email")).toBeNull();
});

test("name form requires at least two characters", async () => {
  const onUpdateName = vi.fn(async () => {});
  await using view = await renderReadyProfile({
    notice: null,
    onChangeEmail: vi.fn(async () => {}),
    onChangePassword: vi.fn(async () => {}),
    onSendVerification: vi.fn(async () => {}),
    onUpdateName,
    user: verifiedUser,
  });

  fireEvent.change(htmlInput(view.getByLabelText("Your name")), {
    target: { value: "A" },
  });
  fireEvent.click(view.getByRole("button", { name: "Save name" }));

  await vi.waitFor(() => {
    expect(view.getByText("Name must be at least 2 characters")).toBeTruthy();
  });
  expect(onUpdateName).not.toHaveBeenCalled();
});

test("profileSessionSnapshot maps a user or logged-out null", () => {
  expect(profileSessionSnapshot(null)).toEqual({ data: null });
  expect(profileSessionSnapshot(verifiedUser)).toEqual({
    data: { user: verifiedUser },
  });
});

test("profile route head sets the document title", () => {
  // @ts-expect-error — stub match is the locale head reads
  const head: (opts: { match: { context: { locale: "en-GB" } } }) => {
    meta: Array<{ title: string | undefined }>;
  } = Route.options.head;
  const result = head({ match: { context: { locale: "en-GB" } } });
  expect(result.meta.some((entry) => entry.title?.includes("Profile"))).toBe(true);
});

function renderProfileRoute(harness: ConvexTestHarness, initialEntry: string) {
  return renderMountedFileRoute({
    harness,
    initialEntry,
    overlayHistory: null,
    path: "/dashboard/profile",
    route: Route,
    wrap: null,
  });
}

function stubProfileAuth(overrides: {
  changeEmail:
    | ((body: {
        callbackURL: string;
        newEmail: string;
      }) => Promise<{ error: { message: string | undefined } | null }>)
    | null;
  changePassword:
    | ((body: {
        currentPassword: string;
        newPassword: string;
        revokeOtherSessions: true;
      }) => Promise<{ error: { message: string | undefined } | null }>)
    | null;
  sendVerificationEmail:
    | ((body: {
        callbackURL: string;
        email: string;
      }) => Promise<{ error: { message: string | undefined } | null }>)
    | null;
  updateUser:
    | ((body: { name: string }) => Promise<{ error: { message: string | undefined } | null }>)
    | null;
  useSession: (() => ProfileSessionSnapshot) | null;
}) {
  const originalChangeEmail = profileAuthAdapter.changeEmail;
  const originalChangePassword = profileAuthAdapter.changePassword;
  const originalSendVerificationEmail = profileAuthAdapter.sendVerificationEmail;
  const originalUpdateUser = profileAuthAdapter.updateUser;
  const originalUseSession = profileAuthAdapter.useSession;
  if (overrides.changeEmail !== null) {
    // SAFETY: Test stub replaces the adapter's network-backed Better Auth method.
    profileAuthAdapter.changeEmail = overrides.changeEmail as typeof profileAuthAdapter.changeEmail;
  }
  if (overrides.changePassword !== null) {
    // SAFETY: Test stub replaces the adapter's network-backed Better Auth method.
    profileAuthAdapter.changePassword =
      overrides.changePassword as typeof profileAuthAdapter.changePassword;
  }
  if (overrides.sendVerificationEmail !== null) {
    // SAFETY: Test stub replaces the adapter's network-backed Better Auth method.
    profileAuthAdapter.sendVerificationEmail =
      overrides.sendVerificationEmail as typeof profileAuthAdapter.sendVerificationEmail;
  }
  if (overrides.updateUser !== null) {
    // SAFETY: Test stub replaces the adapter's network-backed Better Auth method.
    profileAuthAdapter.updateUser = overrides.updateUser as typeof profileAuthAdapter.updateUser;
  }
  if (overrides.useSession !== null) {
    profileAuthAdapter.useSession = overrides.useSession;
  }
  return makeResource({}, () => {
    profileAuthAdapter.changeEmail = originalChangeEmail;
    profileAuthAdapter.changePassword = originalChangePassword;
    profileAuthAdapter.sendVerificationEmail = originalSendVerificationEmail;
    profileAuthAdapter.updateUser = originalUpdateUser;
    profileAuthAdapter.useSession = originalUseSession;
  });
}

function successAuth() {
  return Promise.resolve({ error: null });
}

test("ProfilePage name path invokes the wired auth client", async () => {
  const updateUser = vi.fn(successAuth);
  await using _adapter = stubProfileAuth({
    changeEmail: null,
    changePassword: null,
    sendVerificationEmail: null,
    updateUser,
    useSession: () => profileSessionSnapshot(verifiedUser),
  });
  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderProfileRoute(harness, "/dashboard/profile");

  fireEvent.change(htmlInput(ctx.view.getByLabelText("Your name")), {
    target: { value: "Ada Lovelace" },
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Save name" }));

  await vi.waitFor(() => {
    expect(updateUser).toHaveBeenCalledWith({ name: "Ada Lovelace" });
  });
  await vi.waitFor(() => {
    expect(ctx.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        replace: true,
        search: { notice: "name" },
        to: "/dashboard/profile",
      }),
    );
  });
});

test("ProfilePage password path invokes the wired auth client", async () => {
  const changePassword = vi.fn(successAuth);
  await using _adapter = stubProfileAuth({
    changeEmail: null,
    changePassword,
    sendVerificationEmail: null,
    updateUser: null,
    useSession: () => profileSessionSnapshot(verifiedUser),
  });
  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderProfileRoute(harness, "/dashboard/profile");

  fireEvent.change(htmlInput(ctx.view.getByLabelText("Current password")), {
    target: { value: "old-password" },
  });
  fireEvent.change(htmlInput(ctx.view.getByLabelText("New password")), {
    target: { value: "new-password" },
  });
  fireEvent.change(htmlInput(ctx.view.getByLabelText("Confirm new password")), {
    target: { value: "new-password" },
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Update password" }));

  await vi.waitFor(() => {
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "old-password",
      newPassword: "new-password",
      revokeOtherSessions: true,
    });
  });
  await vi.waitFor(() => {
    expect(ctx.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        replace: true,
        search: { notice: "password" },
        to: "/dashboard/profile",
      }),
    );
  });
});

test("ProfilePage verify path invokes the wired auth client", async () => {
  const sendVerificationEmail = vi.fn(successAuth);
  await using _adapter = stubProfileAuth({
    changeEmail: null,
    changePassword: null,
    sendVerificationEmail,
    updateUser: null,
    useSession: () => profileSessionSnapshot(unverifiedUser),
  });
  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderProfileRoute(harness, "/dashboard/profile");

  fireEvent.click(ctx.view.getByRole("button", { name: "Send verification email" }));

  await vi.waitFor(() => {
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      callbackURL: "https://example.test/dashboard/profile?notice=verified",
      email: "ada@example.com",
    });
  });
  await vi.waitFor(() => {
    expect(ctx.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        replace: true,
        search: { notice: "verify-sent" },
        to: "/dashboard/profile",
      }),
    );
  });
});

test("ProfilePage change-email path invokes the wired auth client", async () => {
  const changeEmail = vi.fn(successAuth);
  await using _adapter = stubProfileAuth({
    changeEmail,
    changePassword: null,
    sendVerificationEmail: null,
    updateUser: null,
    useSession: () => profileSessionSnapshot(verifiedUser),
  });
  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderProfileRoute(harness, "/dashboard/profile");

  fireEvent.change(htmlInput(ctx.view.getByLabelText("New email")), {
    target: { value: "new@example.com" },
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Change email" }));

  await vi.waitFor(() => {
    expect(changeEmail).toHaveBeenCalledWith({
      callbackURL: "https://example.test/dashboard/profile?notice=verified",
      newEmail: "new@example.com",
    });
  });
  await vi.waitFor(() => {
    expect(ctx.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        replace: true,
        search: { notice: "email-change-sent" },
        to: "/dashboard/profile",
      }),
    );
  });
});

function stubToastError() {
  const toastError = vi.spyOn(toast, "error").mockReturnValue("toast-id");
  return makeResource({ toastError }, () => {
    toastError.mockRestore();
  });
}

test("ProfilePage name path throws the fallback when Better Auth omits a message", async () => {
  await using toasts = stubToastError();
  const updateUser = vi.fn(async () => ({ error: { message: undefined } }));
  await using _adapter = stubProfileAuth({
    changeEmail: null,
    changePassword: null,
    sendVerificationEmail: null,
    updateUser,
    useSession: () => profileSessionSnapshot(verifiedUser),
  });
  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderProfileRoute(harness, "/dashboard/profile");

  fireEvent.change(htmlInput(ctx.view.getByLabelText("Your name")), {
    target: { value: "Ada Lovelace" },
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Save name" }));

  await vi.waitFor(() => {
    expect(toasts.toastError).toHaveBeenCalledWith("Unable to update your name");
  });
  expect(ctx.navigate).not.toHaveBeenCalled();
});

test("ProfilePage password path surfaces the Better Auth message", async () => {
  await using toasts = stubToastError();
  const changePassword = vi.fn(async () => ({ error: { message: "Wrong password" } }));
  await using _adapter = stubProfileAuth({
    changeEmail: null,
    changePassword,
    sendVerificationEmail: null,
    updateUser: null,
    useSession: () => profileSessionSnapshot(verifiedUser),
  });
  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderProfileRoute(harness, "/dashboard/profile");

  fireEvent.change(htmlInput(ctx.view.getByLabelText("Current password")), {
    target: { value: "old-password" },
  });
  fireEvent.change(htmlInput(ctx.view.getByLabelText("New password")), {
    target: { value: "new-password" },
  });
  fireEvent.change(htmlInput(ctx.view.getByLabelText("Confirm new password")), {
    target: { value: "new-password" },
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Update password" }));

  await vi.waitFor(() => {
    expect(toasts.toastError).toHaveBeenCalledWith("Wrong password");
  });
  expect(ctx.navigate).not.toHaveBeenCalled();
});

test("ProfilePage change-email path surfaces the Better Auth message", async () => {
  await using toasts = stubToastError();
  const changeEmail = vi.fn(async () => ({ error: { message: "Email taken" } }));
  await using _adapter = stubProfileAuth({
    changeEmail,
    changePassword: null,
    sendVerificationEmail: null,
    updateUser: null,
    useSession: () => profileSessionSnapshot(verifiedUser),
  });
  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderProfileRoute(harness, "/dashboard/profile");

  fireEvent.change(htmlInput(ctx.view.getByLabelText("New email")), {
    target: { value: "new@example.com" },
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Change email" }));

  await vi.waitFor(() => {
    expect(toasts.toastError).toHaveBeenCalledWith("Email taken");
  });
  expect(ctx.navigate).not.toHaveBeenCalled();
});

test("ProfilePage verify path surfaces the Better Auth message", async () => {
  await using toasts = stubToastError();
  const sendVerificationEmail = vi.fn(async () => ({ error: { message: "Rate limited" } }));
  await using _adapter = stubProfileAuth({
    changeEmail: null,
    changePassword: null,
    sendVerificationEmail,
    updateUser: null,
    useSession: () => profileSessionSnapshot(unverifiedUser),
  });
  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderProfileRoute(harness, "/dashboard/profile");

  fireEvent.click(ctx.view.getByRole("button", { name: "Send verification email" }));

  await vi.waitFor(() => {
    expect(toasts.toastError).toHaveBeenCalledWith("Rate limited");
  });
  expect(ctx.navigate).not.toHaveBeenCalled();
});

test("ProfilePage shows loading when the real session hook is logged out", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  await using ctx = await renderProfileRoute(harness, "/dashboard/profile");

  expect(ctx.view.getByText("Loading")).toBeTruthy();
});
