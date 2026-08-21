import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { LocaleProvider } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn<(opts: { to: string }) => Promise<void>>(async () => {}),
  signUpEmail: vi.fn<
    (
      opts: { email: string; password: string; name: string },
      fetchOptions: { headers: Record<string, string> },
    ) => Promise<{
      error: { message: string } | null;
    }>
  >(async () => ({ error: null })),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: { component: () => ReactElement }) => opts,
  Link: (props: React.ComponentProps<"a"> & { to: string | undefined }) => (
    <a href={typeof props.to === "string" ? props.to : "#"}>{props.children}</a>
  ),
  useRouter: () => ({ navigate: mocks.navigate }),
}));

vi.mock("@/lib/auth-client", () => ({
  getBrowserAuthHeaders: () => ({ "x-time-zone": "Asia/Tokyo" }),
  authClient: {
    signUp: {
      email: (
        opts: { email: string; password: string; name: string },
        fetchOptions: { headers: Record<string, string> },
      ) => mocks.signUpEmail(opts, fetchOptions),
    },
  },
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

test("signup sends browser preference hints", async () => {
  mocks.navigate.mockClear();
  mocks.signUpEmail.mockClear();
  mocks.signUpEmail.mockResolvedValueOnce({ error: null });
  await using _view = renderSignup();

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alice" } });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "alice@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password123" },
  });
  const form = screen.getByLabelText("Email").closest("form");
  if (!form) throw new Error("signup form missing");
  fireEvent.submit(form);

  await vi.waitFor(() => {
    expect(mocks.signUpEmail).toHaveBeenCalledWith(
      {
        email: "alice@example.com",
        password: "password123",
        name: "Alice",
      },
      { headers: { "x-time-zone": "Asia/Tokyo" } },
    );
  });
  expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
});
