import { fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import type { TranslationFunction } from "@/lib/i18n";
import { htmlInput } from "@/test/htmlElement";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import {
  ProfilePageView,
  Route,
  completeProfileAuthAction,
  profileNoticeMessage,
  type ProfileNotice,
  type ProfilePageHandlers,
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
