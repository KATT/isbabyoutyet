import { fireEvent, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { LocaleProvider } from "@/lib/i18n";
import {
  SignupCard,
  SignupPage,
  signupAuthAdapter,
  Route,
  signUpAndHandoff,
} from "@/routes/auth/signup";
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

test("SignupPage wires the real auth client into SignupCard", async () => {
  await using _view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <SignupPage />
    </LocaleProvider>,
    { path: "/auth/signup" },
  );

  expect(screen.getByLabelText("Name")).toBeTruthy();
  expect(screen.getByLabelText("Email")).toBeTruthy();
  expect(screen.getByLabelText("Password")).toBeTruthy();
  expect(screen.getByRole("button", { name: /sign up|create/i })).toBeTruthy();
});

test("SignupPage sign-up path invokes the wired auth client", async () => {
  const signUpEmail = vi.fn().mockResolvedValue({ data: null, error: null });
  const original = {
    signUpEmail: signupAuthAdapter.signUpEmail,
    headers: signupAuthAdapter.headers,
    waitForAuth: signupAuthAdapter.waitForAuth,
  };
  signupAuthAdapter.signUpEmail = signUpEmail as typeof signupAuthAdapter.signUpEmail;
  signupAuthAdapter.headers = () => ({ "x-time-zone": "Asia/Tokyo" });
  signupAuthAdapter.waitForAuth = async () => undefined;
  await using _adapter = makeResource({}, () => {
    signupAuthAdapter.signUpEmail = original.signUpEmail;
    signupAuthAdapter.headers = original.headers;
    signupAuthAdapter.waitForAuth = original.waitForAuth;
  });

  await using view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <SignupPage />
    </LocaleProvider>,
    { path: "/auth/signup" },
  );
  const navigate = vi.spyOn(view.router, "navigate").mockResolvedValue(undefined);
  await using _navigate = makeResource({}, () => {
    navigate.mockRestore();
  });

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: NEW_ACCOUNT.name } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: NEW_ACCOUNT.email } });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: NEW_ACCOUNT.password },
  });
  fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

  await vi.waitFor(() => {
    expect(signUpEmail).toHaveBeenCalled();
  });
  await vi.waitFor(() => {
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });
});

test("signup route head sets the document title", () => {
  const head = Route.options.head as unknown as (opts: {
    match: { context: { locale: "en-GB" } };
  }) => { meta: Array<{ title: string | undefined }> };
  const result = head({ match: { context: { locale: "en-GB" } } });
  expect(result.meta.some((entry) => entry.title?.includes("Sign up"))).toBe(true);
});
