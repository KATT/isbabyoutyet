import { Check } from "@phosphor-icons/react";
import { fireEvent, render } from "@testing-library/react";
import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import { z } from "zod";
import { makeResource } from "@workspace/convex/convex/test.resource";
import {
  Form,
  SubmitButton,
  useZodForm,
} from "@/components/Form";
import { LocaleProvider } from "@/lib/i18n";

function renderResource(ui: React.ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

function spyOnToastErrorResource() {
  const toastError = vi.spyOn(toast, "error").mockReturnValue("toast-id");
  return makeResource(toastError, () => {
    toastError.mockRestore();
  });
}

function ContextSubmitForm(props: {
  onSubmit: (values: { note: string }) => Promise<void>;
  disabled: boolean | undefined;
}) {
  const form = useZodForm({
    schema: z.object({ note: z.string() }),
    defaultValues: { note: "hi" },
  });
  return (
    <Form form={form} handleSubmit={props.onSubmit}>
      <SubmitButton
        form="context"
        IconComponent={Check}
        iconPosition="start"
        disabled={props.disabled}
      >
        Send
      </SubmitButton>
    </Form>
  );
}

function ExplicitSubmitForm(props: { onSubmit: (values: { note: string }) => Promise<void> }) {
  const form = useZodForm({
    schema: z.object({ note: z.string() }),
    defaultValues: { note: "hi" },
  });
  return (
    <div>
      <Form form={form} handleSubmit={props.onSubmit}>
        <span>fields</span>
      </Form>
      <SubmitButton form={form} IconComponent={Check} iconPosition="end">
        Send
      </SubmitButton>
    </div>
  );
}

test("SubmitButton keeps its label and swaps the icon for a spinner while submitting", async () => {
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });
  vi.useFakeTimers();

  let releaseSubmit: (() => void) | undefined;
  const onSubmit = vi.fn(async () => {
    await new Promise<void>((resolve) => {
      releaseSubmit = resolve;
    });
  });

  await using view = renderResource(
    <LocaleProvider locale="en-GB">
      <ContextSubmitForm onSubmit={onSubmit} disabled={undefined} />
    </LocaleProvider>,
  );

  const button = view.getByRole("button", { name: "Send" }) as HTMLButtonElement;
  expect(view.queryByRole("status")).toBeNull();
  expect(button.disabled).toBe(false);
  expect(button.getAttribute("aria-busy")).toBe("false");

  fireEvent.click(button);

  await vi.advanceTimersByTimeAsync(500);

  await vi.waitFor(() => {
    expect(button.disabled).toBe(true);
  });
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.querySelector('[data-slot="spinner"]')).toBeTruthy();
  expect(button.textContent).toContain("Send");
  expect(onSubmit).toHaveBeenCalledWith({ note: "hi" });

  releaseSubmit?.();
  await vi.advanceTimersByTimeAsync(0);

  await vi.waitFor(() => {
    expect(button.disabled).toBe(false);
  });
  expect(button.querySelector('[data-slot="spinner"]')).toBeNull();
  expect(button.getAttribute("aria-busy")).toBe("false");
});
test("SubmitButton can target an explicit form outside the <form> element", async () => {
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });
  vi.useFakeTimers();

  const onSubmit = vi.fn(async () => undefined);

  await using view = renderResource(
    <LocaleProvider locale="en-GB">
      <ExplicitSubmitForm onSubmit={onSubmit} />
    </LocaleProvider>,
  );

  const button = view.getByRole("button", { name: "Send" });
  const formId = button.getAttribute("form");
  expect(formId).toBeTruthy();
  expect(document.getElementById(formId ?? "")).toBeTruthy();

  fireEvent.click(button);
  await vi.advanceTimersByTimeAsync(500);

  await vi.waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({ note: "hi" });
  });
});

test("SubmitButton honors an extra disabled prop while idle", async () => {
  await using view = renderResource(
    <LocaleProvider locale="en-GB">
      <ContextSubmitForm onSubmit={vi.fn(async () => undefined)} disabled={true} />
    </LocaleProvider>,
  );

  expect((view.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
});

test("Form surfaces uncaught submit errors as a toast", async () => {
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });
  vi.useFakeTimers();

  await using toastError = spyOnToastErrorResource();

  const onSubmit = vi.fn(async () => {
    throw new Error("Nope");
  });

  await using view = renderResource(
    <LocaleProvider locale="en-GB">
      <ContextSubmitForm onSubmit={onSubmit} disabled={undefined} />
    </LocaleProvider>,
  );

  fireEvent.click(view.getByRole("button", { name: "Send" }));
  await vi.advanceTimersByTimeAsync(500);

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith("Nope");
  });
});

test("SubmitButton supports an emoji glyph at the end of the label", async () => {
  function EmojiSubmitForm() {
    const form = useZodForm({
      schema: z.object({ note: z.string() }),
      defaultValues: { note: "hi" },
    });
    return (
      <Form form={form} handleSubmit={async () => undefined}>
        <SubmitButton form="context" IconComponent="🍼" iconPosition="end">
          Add Baby
        </SubmitButton>
      </Form>
    );
  }

  await using view = renderResource(
    <LocaleProvider locale="en-GB">
      <EmojiSubmitForm />
    </LocaleProvider>,
  );

  const button = view.getByRole("button", { name: "Add Baby" });
  expect(button.textContent).toContain("🍼");
  expect(button.textContent?.endsWith("🍼")).toBe(true);
});
