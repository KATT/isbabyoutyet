import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { DEMO_ACCOUNTS, DEMO_EMPTY_USER, DEMO_USER } from "@workspace/convex/src/seedCredentials";

const mocks = vi.hoisted(() => ({
  hasDemoLogin: true,
  navigate: vi.fn<(opts: { to: string }) => Promise<void>>(async () => {}),
  signInEmail: vi.fn<
    (opts: { email: string; password: string; rememberMe: boolean }) => Promise<{
      error: { message: string } | null;
    }>
  >(async () => ({ error: null })),
  toastError: vi.fn<(message: string) => void>(),
}));

vi.mock("@/lib/has-demo-login", () => ({
  get hasDemoLogin() {
    return mocks.hasDemoLogin;
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ navigate: mocks.navigate }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: (opts: { email: string; password: string; rememberMe: boolean }) =>
        mocks.signInEmail(opts),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: (message: string) => mocks.toastError(message),
  },
}));

const { DemoAccountPicker } = await import("./demo-account-picker");

function renderPicker(onPrefill: (account: (typeof DEMO_ACCOUNTS)[number]) => void) {
  const view = render(<DemoAccountPicker onPrefill={onPrefill} />);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("lists seeded test accounts and signs in after a choice", async () => {
  mocks.hasDemoLogin = true;
  mocks.navigate.mockClear();
  mocks.signInEmail.mockClear();
  mocks.signInEmail.mockResolvedValueOnce({ error: null });

  const onPrefill = vi.fn<(account: (typeof DEMO_ACCOUNTS)[number]) => void>();
  await using _view = renderPicker(onPrefill);

  const picker = screen.getByLabelText("Test account");
  for (const account of DEMO_ACCOUNTS) {
    expect(screen.getByRole("option", { name: account.label })).toBeTruthy();
  }

  fireEvent.change(picker, { target: { value: DEMO_EMPTY_USER.email } });

  expect(onPrefill).toHaveBeenCalledWith(
    expect.objectContaining({
      email: DEMO_EMPTY_USER.email,
      password: DEMO_EMPTY_USER.password,
      name: DEMO_EMPTY_USER.name,
    }),
  );

  await vi.waitFor(() => {
    expect(mocks.signInEmail).toHaveBeenCalledWith({
      email: DEMO_EMPTY_USER.email,
      password: DEMO_EMPTY_USER.password,
      rememberMe: true,
    });
  });
  expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
});

test("signs in as the parent account with babies", async () => {
  mocks.hasDemoLogin = true;
  mocks.navigate.mockClear();
  mocks.signInEmail.mockClear();
  mocks.signInEmail.mockResolvedValueOnce({ error: null });

  const onPrefill = vi.fn<(account: (typeof DEMO_ACCOUNTS)[number]) => void>();
  await using _view = renderPicker(onPrefill);

  fireEvent.change(screen.getByLabelText("Test account"), {
    target: { value: DEMO_USER.email },
  });

  await vi.waitFor(() => {
    expect(mocks.signInEmail).toHaveBeenCalledWith({
      email: DEMO_USER.email,
      password: DEMO_USER.password,
      rememberMe: true,
    });
  });
  expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
});

test("shows the auth error when sign-in fails", async () => {
  mocks.hasDemoLogin = true;
  mocks.navigate.mockClear();
  mocks.signInEmail.mockClear();
  mocks.toastError.mockClear();
  mocks.signInEmail.mockResolvedValueOnce({ error: { message: "Invalid credentials" } });

  await using _view = renderPicker(() => {});

  fireEvent.change(screen.getByLabelText("Test account"), {
    target: { value: DEMO_USER.email },
  });

  await vi.waitFor(() => {
    expect(mocks.toastError).toHaveBeenCalledWith("Invalid credentials");
  });
  expect(mocks.navigate).not.toHaveBeenCalled();
});

test("hides entirely when demo login is disabled", async () => {
  mocks.hasDemoLogin = false;

  await using _view = renderPicker(() => {});

  expect(screen.queryByLabelText("Test account")).toBeNull();
});
