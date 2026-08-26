import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { DEMO_ACCOUNTS, DEMO_EMPTY_USER } from "@workspace/convex/src/seedCredentials";
import { DemoAccountPicker } from "./demo-account-picker";

function renderPicker(opts: {
  onPrefill: (account: (typeof DEMO_ACCOUNTS)[number]) => void;
  enabled: boolean;
}) {
  const view = render(<DemoAccountPicker onPrefill={opts.onPrefill} enabled={opts.enabled} />);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("lists seeded test accounts and reports the chosen one", async () => {
  const onPrefill = vi.fn<(account: (typeof DEMO_ACCOUNTS)[number]) => void>();
  await using _view = renderPicker({ onPrefill, enabled: true });

  for (const account of DEMO_ACCOUNTS) {
    expect(screen.getByRole("option", { name: account.label })).toBeTruthy();
  }

  fireEvent.change(screen.getByLabelText("Test account"), {
    target: { value: DEMO_EMPTY_USER.email },
  });

  expect(onPrefill).toHaveBeenCalledWith(
    expect.objectContaining({
      email: DEMO_EMPTY_USER.email,
      password: DEMO_EMPTY_USER.password,
      name: DEMO_EMPTY_USER.name,
    }),
  );
  expect(onPrefill).toHaveBeenCalledTimes(1);
});

test("hides entirely when demo login is disabled", async () => {
  await using _view = renderPicker({ onPrefill: () => {}, enabled: false });

  expect(screen.queryByLabelText("Test account")).toBeNull();
});
