import { Check } from "@phosphor-icons/react";
import { fireEvent, render } from "@testing-library/react";
import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import { z } from "zod";
import { makeResource } from "@workspace/convex/convex/test.resource";
import {
  Form,
  FormCancelButton,
  FormOverlayProvider,
  shouldBlockOverlayDismiss,
  SubmitButton,
  useFormOverlay,
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
      <FormCancelButton form="context">Cancel</FormCancelButton>
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

test("SubmitButton throws when used outside a Form without an explicit form", () => {
  expect(() => {
    render(
      <LocaleProvider locale="en-GB">
        <SubmitButton form="context" IconComponent={Check} iconPosition="start">
          Send
        </SubmitButton>
      </LocaleProvider>,
    );
  }).toThrow("SubmitButton must be used within a Form or have a form prop");
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

test("Form toasts a generic message for non-Error throws", async () => {
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });
  vi.useFakeTimers();

  await using toastError = spyOnToastErrorResource();

  const onSubmit = vi.fn(async () => {
    throw "string-fail";
  });

  await using view = renderResource(
    <LocaleProvider locale="en-GB">
      <ContextSubmitForm onSubmit={onSubmit} disabled={undefined} />
    </LocaleProvider>,
  );

  fireEvent.click(view.getByRole("button", { name: "Send" }));
  await vi.advanceTimersByTimeAsync(500);

  await vi.waitFor(() => {
    expect(toastError).toHaveBeenCalledWith("Something went wrong. Try again.");
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

test("SubmitButton accepts IconComponent={null} for label-only actions", async () => {
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

  function NullIconForm() {
    const form = useZodForm({
      schema: z.object({ note: z.string() }),
      defaultValues: { note: "hi" },
    });
    return (
      <Form form={form} handleSubmit={onSubmit}>
        <SubmitButton form="context" IconComponent={null} iconPosition="start">
          Confirm
        </SubmitButton>
      </Form>
    );
  }

  await using view = renderResource(
    <LocaleProvider locale="en-GB">
      <NullIconForm />
    </LocaleProvider>,
  );

  const button = view.getByRole("button", { name: "Confirm" }) as HTMLButtonElement;
  expect(button.querySelector("svg")).toBeNull();
  expect(button.querySelector('[data-slot="spinner"]')).toBeNull();

  fireEvent.click(button);
  await vi.advanceTimersByTimeAsync(500);

  await vi.waitFor(() => {
    expect(button.disabled).toBe(true);
  });
  expect(button.querySelector('[data-slot="spinner"]')).toBeTruthy();

  releaseSubmit?.();
  await vi.advanceTimersByTimeAsync(0);

  await vi.waitFor(() => {
    expect(button.disabled).toBe(false);
  });
  expect(button.querySelector('[data-slot="spinner"]')).toBeNull();
});

test("FormCancelButton honors an extra disabled prop while idle", async () => {
  function DisabledCancelForm() {
    const form = useZodForm({
      schema: z.object({ note: z.string() }),
      defaultValues: { note: "hi" },
    });
    return (
      <Form form={form} handleSubmit={async () => undefined}>
        <FormCancelButton form="context" disabled={true} variant="secondary">
          Cancel
        </FormCancelButton>
      </Form>
    );
  }

  await using view = renderResource(
    <LocaleProvider locale="en-GB">
      <DisabledCancelForm />
    </LocaleProvider>,
  );

  expect((view.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
});

test("FormCancelButton disables while its form is submitting", async () => {
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

  const cancel = view.getByRole("button", { name: "Cancel" }) as HTMLButtonElement;
  expect(cancel.disabled).toBe(false);

  fireEvent.click(view.getByRole("button", { name: "Send" }));
  await vi.advanceTimersByTimeAsync(500);

  await vi.waitFor(() => {
    expect(cancel.disabled).toBe(true);
  });

  releaseSubmit?.();
  await vi.advanceTimersByTimeAsync(0);

  await vi.waitFor(() => {
    expect(cancel.disabled).toBe(false);
  });
});

test("shouldBlockOverlayDismiss locks user dismissals but allows imperative closes", () => {
  expect(
    shouldBlockOverlayDismiss({
      isLocked: true,
      open: false,
      reason: "escape-key",
    }),
  ).toBe(true);
  expect(
    shouldBlockOverlayDismiss({
      isLocked: true,
      open: false,
      reason: "outside-press",
    }),
  ).toBe(true);
  expect(
    shouldBlockOverlayDismiss({
      isLocked: true,
      open: false,
      reason: "close-press",
    }),
  ).toBe(true);
  expect(
    shouldBlockOverlayDismiss({
      isLocked: true,
      open: false,
      reason: "imperative-action",
    }),
  ).toBe(false);
  expect(
    shouldBlockOverlayDismiss({
      isLocked: false,
      open: false,
      reason: "escape-key",
    }),
  ).toBe(false);
  expect(
    shouldBlockOverlayDismiss({
      isLocked: true,
      open: true,
      reason: "trigger-press",
    }),
  ).toBe(false);
});

test("useFormOverlay blocks escape while submitting and forwards when idle", async () => {
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
  const forwarded = vi.fn();
  const actionsClose = vi.fn();

  function OverlayLockForm() {
    const overlay = useFormOverlay({
      onOpenChange: (open, eventDetails) => {
        forwarded({ open, reason: eventDetails.reason });
      },
    });
    const form = useZodForm({
      schema: z.object({ note: z.string() }),
      defaultValues: { note: "hi" },
    });

    return (
      <FormOverlayProvider overlay={overlay}>
        <button
          type="button"
          onClick={() => {
            const cancel = vi.fn();
            overlay.rootProps.onOpenChange(false, {
              reason: "escape-key",
              cancel,
            });
            (document.getElementById("dismiss-result") as HTMLInputElement).value = String(
              cancel.mock.calls.length,
            );
          }}
        >
          TryEscape
        </button>
        <button
          type="button"
          onClick={() => {
            const cancel = vi.fn();
            overlay.rootProps.onOpenChange(false, {
              reason: "imperative-action",
              cancel,
            });
            (document.getElementById("imperative-result") as HTMLInputElement).value = String(
              cancel.mock.calls.length,
            );
          }}
        >
          TryImperative
        </button>
        <button
          type="button"
          onClick={() => {
            overlay.rootProps.actionsRef.current = {
              close: actionsClose,
              unmount: () => undefined,
            };
            overlay.close();
          }}
        >
          Close
        </button>
        <input id="dismiss-result" readOnly defaultValue="unset" />
        <input id="imperative-result" readOnly defaultValue="unset" />
        <Form form={form} handleSubmit={onSubmit}>
          <FormCancelButton form={form}>Cancel</FormCancelButton>
          <SubmitButton form="context" IconComponent={Check} iconPosition="start">
            Send
          </SubmitButton>
        </Form>
      </FormOverlayProvider>
    );
  }

  await using view = renderResource(
    <LocaleProvider locale="en-GB">
      <OverlayLockForm />
    </LocaleProvider>,
  );

  fireEvent.click(view.getByRole("button", { name: "TryEscape" }));
  expect((document.getElementById("dismiss-result") as HTMLInputElement).value).toBe("0");
  expect(forwarded).toHaveBeenCalledWith({ open: false, reason: "escape-key" });
  forwarded.mockClear();

  fireEvent.click(view.getByRole("button", { name: "Send" }));
  await vi.advanceTimersByTimeAsync(500);
  await vi.waitFor(() => {
    expect((view.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
  });

  fireEvent.click(view.getByRole("button", { name: "TryEscape" }));
  expect((document.getElementById("dismiss-result") as HTMLInputElement).value).toBe("1");
  expect(forwarded).not.toHaveBeenCalled();

  fireEvent.click(view.getByRole("button", { name: "TryImperative" }));
  expect((document.getElementById("imperative-result") as HTMLInputElement).value).toBe("0");
  expect(forwarded).toHaveBeenCalledWith({ open: false, reason: "imperative-action" });

  fireEvent.click(view.getByRole("button", { name: "Close" }));
  expect(actionsClose).toHaveBeenCalled();

  releaseSubmit?.();
  await vi.advanceTimersByTimeAsync(0);
  await vi.waitFor(() => {
    expect((view.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});

test("useFormOverlay close is a no-op without an actions handle", async () => {
  function IdleOverlay() {
    const overlay = useFormOverlay({ onOpenChange: undefined });
    return (
      <>
        <button type="button" onClick={() => overlay.close()}>
          Close
        </button>
        <button
          type="button"
          onClick={() => {
            overlay.rootProps.onOpenChange(false, {
              reason: "escape-key",
              cancel: () => undefined,
            });
          }}
        >
          EscapeIdle
        </button>
      </>
    );
  }

  await using view = renderResource(
    <LocaleProvider locale="en-GB">
      <IdleOverlay />
    </LocaleProvider>,
  );

  expect(() => {
    fireEvent.click(view.getByRole("button", { name: "Close" }));
  }).not.toThrow();
  expect(() => {
    fireEvent.click(view.getByRole("button", { name: "EscapeIdle" }));
  }).not.toThrow();
});
