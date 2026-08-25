import { fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { FunctionReturnType } from "convex/server";
import { api } from "@workspace/convex/convex/_generated/api";
import { LocaleProvider } from "@/lib/i18n";
import { LanguageSettingsView } from "./language-settings";

type Profile = FunctionReturnType<typeof api.profile.get>;

const profile: NonNullable<Profile> = {
  locale: "en-GB",
  timeZone: "Europe/London",
  isAdmin: false,
};

function renderViewResource(opts: {
  profile: Profile;
  onUpdateLocale: (args: { locale: string }) => Promise<unknown>;
  onUpdateTimeZone: (args: { timeZone: string }) => Promise<unknown>;
  onRequestLanguage: (args: { requestedLocale: string }) => Promise<unknown>;
  onApplyLocale: (locale: "en-GB" | "sv" | "en-US" | "es" | "pt-BR") => Promise<void>;
}) {
  const view = render(
    <LocaleProvider locale="en-GB">
      <LanguageSettingsView
        profile={opts.profile}
        className={undefined}
        onUpdateLocale={opts.onUpdateLocale}
        onUpdateTimeZone={opts.onUpdateTimeZone}
        onRequestLanguage={opts.onRequestLanguage}
        onApplyLocale={opts.onApplyLocale}
      />
    </LocaleProvider>,
  );
  return makeResource(view, () => {
    view.unmount();
  });
}

function defaultHandlers() {
  return {
    onUpdateLocale: vi.fn<(args: { locale: string }) => Promise<unknown>>().mockResolvedValue(null),
    onUpdateTimeZone: vi
      .fn<(args: { timeZone: string }) => Promise<unknown>>()
      .mockResolvedValue(null),
    onRequestLanguage: vi
      .fn<(args: { requestedLocale: string }) => Promise<unknown>>()
      .mockResolvedValue(null),
    onApplyLocale: vi
      .fn<(locale: "en-GB" | "sv" | "en-US" | "es" | "pt-BR") => Promise<void>>()
      .mockResolvedValue(undefined),
  };
}

test("changing the profile language persists it and applies the locale", async () => {
  const handlers = defaultHandlers();
  await using _view = renderViewResource({ profile, ...handlers });

  fireEvent.click(screen.getByRole("combobox", { name: "Profile language" }));
  const swedish = screen.getByRole("option", { name: /^svenska$/i });
  fireEvent.pointerDown(swedish, { pointerType: "mouse" });
  fireEvent.click(swedish);

  await vi.waitFor(() => {
    expect(handlers.onUpdateLocale).toHaveBeenCalledWith({ locale: "sv" });
  });
  await vi.waitFor(() => {
    expect(handlers.onApplyLocale).toHaveBeenCalledWith("sv");
  });
});

test("changing the profile time zone persists it", async () => {
  const handlers = defaultHandlers();
  await using _view = renderViewResource({ profile, ...handlers });

  const picker = screen.getByRole("combobox", { name: "Profile time zone" });
  const trigger = picker.parentElement?.querySelector("button");
  if (!trigger) throw new Error("time zone trigger missing");
  fireEvent.focus(picker);
  expect((picker as HTMLInputElement).selectionStart).toBe(0);
  expect((picker as HTMLInputElement).selectionEnd).toBe("London (Europe)".length);
  fireEvent.click(trigger);
  expect((picker as HTMLInputElement).value).toBe("London (Europe)");
  expect(screen.queryByText("No time zones found")).toBeNull();
  fireEvent.input(picker, { target: { value: "Tokyo" } });
  const tokyo = screen.getByRole("option", { name: "Tokyo (Asia)" });
  fireEvent.pointerDown(tokyo, { pointerType: "mouse" });
  fireEvent.click(tokyo);

  expect((picker as HTMLInputElement).value).toBe("Tokyo (Asia)");
  await vi.waitFor(() => {
    expect(handlers.onUpdateTimeZone).toHaveBeenCalledWith({ timeZone: "Asia/Tokyo" });
  });

  // Reselecting the same zone is a no-op (early return in onValueChange).
  handlers.onUpdateTimeZone.mockClear();
  fireEvent.click(trigger);
  fireEvent.input(picker, { target: { value: "Tokyo" } });
  const tokyoAgain = screen.getByRole("option", { name: "Tokyo (Asia)" });
  fireEvent.pointerDown(tokyoAgain, { pointerType: "mouse" });
  fireEvent.click(tokyoAgain);
  expect(handlers.onUpdateTimeZone).not.toHaveBeenCalled();
});

test.each([
  { failure: new Error("Could not save time zone"), expectedMessage: "Could not save time zone" },
  { failure: "offline", expectedMessage: "Something went wrong. Try again." },
])("a failed time zone save rolls back for $expectedMessage", async (testCase) => {
  const handlers = defaultHandlers();
  handlers.onUpdateTimeZone.mockRejectedValueOnce(testCase.failure);
  const toastError = vi.spyOn(toast, "error");
  await using _toast = makeResource({}, () => {
    toastError.mockRestore();
  });
  await using _view = renderViewResource({ profile, ...handlers });

  const picker = screen.getByRole("combobox", { name: "Profile time zone" });
  const trigger = picker.parentElement?.querySelector("button");
  if (!trigger) throw new Error("time zone trigger missing");
  fireEvent.click(trigger);
  fireEvent.input(picker, { target: { value: "Tokyo" } });
  const tokyo = screen.getByRole("option", { name: "Tokyo (Asia)" });
  fireEvent.pointerDown(tokyo, { pointerType: "mouse" });
  fireEvent.click(tokyo);

  await vi.waitFor(() => {
    expect((picker as HTMLInputElement).value).toBe("London (Europe)");
  });
  expect(toastError).toHaveBeenLastCalledWith(testCase.expectedMessage);
});

test("disables the picker and falls back to the UI locale without a profile", async () => {
  const handlers = defaultHandlers();
  await using _view = renderViewResource({ profile: null, ...handlers });

  const picker = screen.getByRole("combobox", { name: "Profile language" });
  expect(picker.getAttribute("aria-disabled") ?? picker.getAttribute("disabled")).not.toBeNull();
});

test("requesting another language submits the request form", async () => {
  const handlers = defaultHandlers();
  await using view = renderViewResource({ profile, ...handlers });

  fireEvent.click(view.getByRole("button", { name: "Request another language" }));
  const input = screen.getByLabelText("Language name or code");
  fireEvent.change(input, {
    target: { value: "French / fr-FR" },
  });
  const form = input.closest("form");
  if (!form) throw new Error("request form missing");
  fireEvent.submit(form);

  await vi.waitFor(() => {
    expect(handlers.onRequestLanguage).toHaveBeenCalledWith({
      requestedLocale: "French / fr-FR",
    });
  });
});
