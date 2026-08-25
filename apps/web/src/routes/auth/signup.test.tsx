import { fireEvent, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import { SignupCard, signUpAndHandoff } from "@/routes/auth/signup";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";

type NewAccount = { name: string; email: string; password: string };
type SignUpResult = { errorMessage: string | null };

const NEW_ACCOUNT: NewAccount = {
  name: "Test Parent",
  email: "parent@example.com",
  password: "password",
};

function renderSignup(onSignUp: (values: NewAccount) => Promise<void>) {
  return renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <SignupCard onSignUp={onSignUp} />
    </LocaleProvider>,
    { path: "/auth/signup" },
  );
}

function handoffDeps() {
  const signUp = vi
    .fn<
      (body: NewAccount, fetchOptions: { headers: Record<string, string> }) => Promise<SignUpResult>
    >()
    .mockResolvedValue({ errorMessage: null });
  const waitForAuth = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const navigate = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  return {
    signUp,
    waitForAuth,
    navigate,
    headers: () => ({ "x-time-zone": "Asia/Tokyo" }),
    failedMessage: "Failed to sign up",
  };
}

test("waits for provider-confirmed Convex auth before navigating", async () => {
  const deps = handoffDeps();
  let confirmAuth = () => {};
  deps.waitForAuth.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      confirmAuth = resolve;
    }),
  );

  const handoff = signUpAndHandoff(NEW_ACCOUNT, deps);

  await vi.waitFor(() => {
    expect(deps.signUp).toHaveBeenCalledWith(NEW_ACCOUNT, {
      headers: { "x-time-zone": "Asia/Tokyo" },
    });
  });
  await vi.waitFor(() => {
    expect(deps.waitForAuth).toHaveBeenCalledTimes(1);
  });
  expect(deps.navigate).not.toHaveBeenCalled();

  confirmAuth();
  await handoff;
  expect(deps.navigate).toHaveBeenCalledTimes(1);
});

test.each([
  { errorMessage: "Email already in use", expectedMessage: "Email already in use" },
  { errorMessage: "", expectedMessage: "Failed to sign up" },
])("a rejected signup throws $expectedMessage and never navigates", async (testCase) => {
  const deps = handoffDeps();
  deps.signUp.mockResolvedValueOnce({ errorMessage: testCase.errorMessage });

  await expect(signUpAndHandoff(NEW_ACCOUNT, deps)).rejects.toThrow(testCase.expectedMessage);
  expect(deps.waitForAuth).not.toHaveBeenCalled();
  expect(deps.navigate).not.toHaveBeenCalled();
});

test("signup has no test-account picker and starts empty", async () => {
  const onSignUp = vi.fn<(values: NewAccount) => Promise<void>>().mockResolvedValue(undefined);
  await using _view = await renderSignup(onSignUp);

  expect(screen.queryByLabelText("Test account")).toBeNull();
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
  expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/auth/login");
});

test("submitting the form hands the new account to the signup flow", async () => {
  const onSignUp = vi.fn<(values: NewAccount) => Promise<void>>().mockResolvedValue(undefined);
  await using _view = await renderSignup(onSignUp);

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: NEW_ACCOUNT.name } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: NEW_ACCOUNT.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: NEW_ACCOUNT.password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

  await vi.waitFor(() => {
    expect(onSignUp).toHaveBeenCalledWith(NEW_ACCOUNT);
  });
});
