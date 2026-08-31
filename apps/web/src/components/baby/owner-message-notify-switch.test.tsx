import { fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { OwnerMessageNotifySwitchView } from "./owner-message-notify-switch";

test("settings switch describes visitor message alerts", async () => {
  const onCheckedChange = vi.fn<(checked: boolean) => void>();
  await using view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <OwnerMessageNotifySwitchView
        checked={false}
        disabled={false}
        disabledReason={null}
        onCheckedChange={onCheckedChange}
        layout="settings"
      />
    </LocaleProvider>,
  );

  const notifySwitch = view.getByRole("switch", { name: "Message notifications" });
  expect(notifySwitch.getAttribute("aria-checked")).toBe("false");
  expect(view.getByText("Get notified when someone leaves a message")).toBeTruthy();

  fireEvent.click(notifySwitch);
  expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true);
});

test("settings switch shows subscribed copy when on", async () => {
  await using view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <OwnerMessageNotifySwitchView
        checked={true}
        disabled={false}
        disabledReason={null}
        onCheckedChange={vi.fn()}
        layout="settings"
      />
    </LocaleProvider>,
  );

  expect(
    view.getByRole("switch", { name: "Message notifications" }).getAttribute("aria-checked"),
  ).toBe("true");
  expect(
    view.getByText("You'll get a push when someone leaves a message on this page."),
  ).toBeTruthy();
});
