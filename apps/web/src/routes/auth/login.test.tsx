import { fireEvent, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { DEMO_EMPTY_USER, DEMO_USER } from "@workspace/convex/src/seedCredentials";
import { LocaleProvider } from "@/lib/i18n";
import {
  LoginCard,
  LoginPage,
  loginAuthAdapter,
  Route,
  signInAndHandoff,
} from "@/routes/auth/login";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { htmlInput } from "@/test/htmlElement";

type SignInResult = { errorMessage: string | null };

function renderLogin(props: {
  demoLoginEnabled: boolean;
  onSignIn: (values: { email: string; password: string }) => Promise<void>;
}) {
  return renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <LoginCard
        demoLoginEnabled={props.demoLoginEnabled}
        onSignIn={props.onSignIn}
        variant="page"
        homeLink={{ to: "/" }}
      />
    </LocaleProvider>,
    { path: "/auth/login" },
  );
}

function handoffDeps() {
  const signIn = vi
    .fn<
      (
        body: { email: string; password: string; rememberMe: boolean },
        fetchOptions: { headers: Record<string, string> },
      ) => Promise<SignInResult>
    >()
    .mockResolvedValue({ errorMessage: null });
  const waitForAuth = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const navigate = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  return {
    signIn,
    waitForAuth,
    navigate,
    headers: () => ({ "x-time-zone": "Asia/Tokyo" }),
    failedMessage: "Failed to sign in",
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

  const handoff = signInAndHandoff({ email: DEMO_USER.email, password: DEMO_USER.password }, deps);

  await vi.waitFor(() => {
    expect(deps.signIn).toHaveBeenCalledWith(
      { email: DEMO_USER.email, password: DEMO_USER.password, rememberMe: true },
      { headers: { "x-time-zone": "Asia/Tokyo" } },
    );
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
  { errorMessage: "Invalid password", expectedMessage: "Invalid password" },
  { errorMessage: "", expectedMessage: "Failed to sign in" },
])("a rejected sign-in throws $expectedMessage and never navigates", async (testCase) => {
  const deps = handoffDeps();
  deps.signIn.mockResolvedValueOnce({ errorMessage: testCase.errorMessage });

  await expect(
    signInAndHandoff({ email: DEMO_USER.email, password: "nope" }, deps),
  ).rejects.toThrow(testCase.expectedMessage);
  expect(deps.waitForAuth).not.toHaveBeenCalled();
  expect(deps.navigate).not.toHaveBeenCalled();
});

test("picking a test account prefills the form and submits it", async () => {
  const onSignIn = vi
    .fn<(values: { email: string; password: string }) => Promise<void>>()
    .mockResolvedValue(undefined);
  await using _view = await renderLogin({ demoLoginEnabled: true, onSignIn });

  expect(htmlInput(screen.getByLabelText("Email")).value).toBe(DEMO_USER.email);

  fireEvent.change(screen.getByLabelText("Test account"), {
    target: { value: DEMO_EMPTY_USER.email },
  });

  expect(htmlInput(screen.getByLabelText("Email")).value).toBe(DEMO_EMPTY_USER.email);
  expect(htmlInput(screen.getByLabelText("Password")).value).toBe(DEMO_EMPTY_USER.password);

  await vi.waitFor(() => {
    expect(onSignIn).toHaveBeenCalledWith({
      email: DEMO_EMPTY_USER.email,
      password: DEMO_EMPTY_USER.password,
    });
  });
});

test("hides the test-account picker when demo login is disabled", async () => {
  const onSignIn = vi
    .fn<(values: { email: string; password: string }) => Promise<void>>()
    .mockResolvedValue(undefined);
  await using _view = await renderLogin({ demoLoginEnabled: false, onSignIn });

  expect(screen.queryByLabelText("Test account")).toBeNull();
  expect(htmlInput(screen.getByLabelText("Email")).value).toBe("");
  expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/auth/signup");
});

test("LoginPage wires the real auth client into LoginCard", async () => {
  await using _view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <LoginPage />
    </LocaleProvider>,
    { path: "/auth/login" },
  );

  expect(screen.getByLabelText("Email")).toBeTruthy();
  expect(screen.getByLabelText("Password")).toBeTruthy();
  expect(screen.getByRole("button", { name: /sign in/i })).toBeTruthy();
});

test("login route head sets the document title", () => {
  // @ts-expect-error — stub match is the locale head reads
  const head: (opts: { match: { context: { locale: "en-GB" } } }) => {
    meta: Array<{ title: string | undefined }>;
  } = Route.options.head;
  const result = head({ match: { context: { locale: "en-GB" } } });
  expect(result.meta.some((entry) => entry.title?.includes("Log in"))).toBe(true);
});

test("LoginPage sign-in path invokes the wired auth client", async () => {
  const signInEmail = vi.fn().mockResolvedValue({ data: null, error: null });
  const original = {
    signInEmail: loginAuthAdapter.signInEmail,
    headers: loginAuthAdapter.headers,
    waitForAuth: loginAuthAdapter.waitForAuth,
  };
  // SAFETY: Mock constructor is installed in place of the browser global.
  loginAuthAdapter.signInEmail = signInEmail as typeof loginAuthAdapter.signInEmail;
  loginAuthAdapter.headers = () => ({ "x-time-zone": "Asia/Tokyo" });
  loginAuthAdapter.waitForAuth = async () => undefined;
  await using _adapter = makeResource({}, () => {
    loginAuthAdapter.signInEmail = original.signInEmail;
    loginAuthAdapter.headers = original.headers;
    loginAuthAdapter.waitForAuth = original.waitForAuth;
  });

  await using view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <LoginPage />
    </LocaleProvider>,
    { path: "/auth/login" },
  );
  const navigate = vi.spyOn(view.router, "navigate").mockResolvedValue(undefined);
  await using _navigate = makeResource({}, () => {
    navigate.mockRestore();
  });

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: DEMO_USER.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: DEMO_USER.password } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

  await vi.waitFor(() => {
    expect(signInEmail).toHaveBeenCalled();
  });
  await vi.waitFor(() => {
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });
});

test("LoginPage returns to an allowlisted baby page after sign-in", async () => {
  const signInEmail = vi.fn().mockResolvedValue({ data: null, error: null });
  const original = {
    signInEmail: loginAuthAdapter.signInEmail,
    headers: loginAuthAdapter.headers,
    waitForAuth: loginAuthAdapter.waitForAuth,
  };
  // SAFETY: Mock constructor is installed in place of the browser global.
  loginAuthAdapter.signInEmail = signInEmail as typeof loginAuthAdapter.signInEmail;
  loginAuthAdapter.headers = () => ({ "x-time-zone": "Asia/Tokyo" });
  loginAuthAdapter.waitForAuth = async () => undefined;
  await using _adapter = makeResource({}, () => {
    loginAuthAdapter.signInEmail = original.signInEmail;
    loginAuthAdapter.headers = original.headers;
    loginAuthAdapter.waitForAuth = original.waitForAuth;
  });

  await using view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <LoginPage />
    </LocaleProvider>,
    { path: "/auth/login?redirect=/baby/baby-waiting" },
  );
  const navigate = vi.spyOn(view.router, "navigate").mockResolvedValue(undefined);
  await using _navigate = makeResource({}, () => {
    navigate.mockRestore();
  });

  expect(screen.getByRole("link", { name: "isbabyoutyet" }).getAttribute("href")).toBe(
    "/baby/baby-waiting",
  );

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: DEMO_USER.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: DEMO_USER.password } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

  await vi.waitFor(() => {
    expect(navigate).toHaveBeenCalledWith({
      to: "/baby/$publicId",
      params: { publicId: "baby-waiting" },
    });
  });
});

test("LoginPage ignores an open-redirect after sign-in", async () => {
  const signInEmail = vi.fn().mockResolvedValue({ data: null, error: null });
  const original = {
    signInEmail: loginAuthAdapter.signInEmail,
    headers: loginAuthAdapter.headers,
    waitForAuth: loginAuthAdapter.waitForAuth,
  };
  // SAFETY: Test stub replaces the adapter's email sign-in method.
  loginAuthAdapter.signInEmail = signInEmail as typeof loginAuthAdapter.signInEmail;
  loginAuthAdapter.headers = () => ({ "x-time-zone": "Asia/Tokyo" });
  loginAuthAdapter.waitForAuth = async () => undefined;
  await using _adapter = makeResource({}, () => {
    loginAuthAdapter.signInEmail = original.signInEmail;
    loginAuthAdapter.headers = original.headers;
    loginAuthAdapter.waitForAuth = original.waitForAuth;
  });

  await using view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <LoginPage />
    </LocaleProvider>,
    { path: "/auth/login?redirect=https://evil.example" },
  );
  const navigate = vi.spyOn(view.router, "navigate").mockResolvedValue(undefined);
  await using _navigate = makeResource({}, () => {
    navigate.mockRestore();
  });

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: DEMO_USER.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: DEMO_USER.password } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

  await vi.waitFor(() => {
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });
});
