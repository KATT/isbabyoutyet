import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { LocaleProvider } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn<(opts: { to: string }) => Promise<void>>(async () => {}),
  signUpEmail: vi.fn<
    (opts: { email: string; password: string; name: string }) => Promise<{
      error: { message: string } | null;
    }>
  >(async () => ({ error: null })),
  waitForConvexAuth: vi.fn<() => Promise<void>>(async () => {}),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: { component: () => ReactElement }) => opts,
  Link: (props: React.ComponentProps<"a"> & { to: string | undefined }) => (
    <a href={typeof props.to === "string" ? props.to : "#"}>{props.children}</a>
  ),
  useRouter: () => ({ navigate: mocks.navigate }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: {
      email: (opts: { email: string; password: string; name: string }) => mocks.signUpEmail(opts),
    },
  },
}));

vi.mock("@/lib/convexAuthHandoff", () => ({
  waitForConvexAuth: () => mocks.waitForConvexAuth(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn<(message: string) => void>() },
}));

const { Route } = await import("./signup");
const SignupPage = (Route as unknown as { component: () => ReactElement }).component;

function renderSignup() {
  const view = render(
    <LocaleProvider locale="en-GB">
      <SignupPage />
    </LocaleProvider>,
  );
  return makeResource(view, () => {
    view.unmount();
  });
}

test("signup has no test-account picker and starts empty", async () => {
  await using _view = renderSignup();

  expect(screen.queryByLabelText("Test account")).toBeNull();
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
});

test("waits for provider-confirmed Convex auth before SPA navigation after signup", async () => {
  mocks.navigate.mockClear();
  mocks.signUpEmail.mockClear();
  mocks.waitForConvexAuth.mockClear();
  mocks.signUpEmail.mockResolvedValueOnce({ error: null });
  let confirmAuth = () => {};
  const authConfirmation = new Promise<void>((resolve) => {
    confirmAuth = resolve;
  });
  mocks.waitForConvexAuth.mockReturnValueOnce(authConfirmation);

  await using _view = renderSignup();

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Test Parent" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "parent@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

  await vi.waitFor(() => {
    expect(mocks.signUpEmail).toHaveBeenCalledWith({
      email: "parent@example.com",
      password: "password",
      name: "Test Parent",
    });
  });
  expect(mocks.waitForConvexAuth).toHaveBeenCalledTimes(1);
  expect(mocks.navigate).not.toHaveBeenCalled();

  confirmAuth();
  await vi.waitFor(() => {
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/dashboard",
    });
  });
});
