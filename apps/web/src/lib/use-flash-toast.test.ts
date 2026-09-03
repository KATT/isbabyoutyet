import { renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { useFlashToast } from "./use-flash-toast";

type FlashToastTestProps = {
  message: string | null;
};

test("toasts the message once then clears", async () => {
  const onClear = vi.fn<() => void>();
  const toastSuccess = vi.spyOn(toast, "success").mockReturnValue("toast-id");
  await using _toast = makeResource({}, () => {
    toastSuccess.mockRestore();
  });

  const initialProps: FlashToastTestProps = {
    message: "Your email is now verified.",
  };
  const hook = renderHook(
    (props) =>
      useFlashToast({
        message: props.message,
        onClear,
      }),
    { initialProps },
  );
  await using _hook = makeResource({}, () => {
    hook.unmount();
  });

  expect(toastSuccess).toHaveBeenCalledWith("Your email is now verified.", {
    id: "Your email is now verified.",
  });
  expect(onClear).toHaveBeenCalledTimes(1);

  hook.rerender({ message: null });
  expect(toastSuccess).toHaveBeenCalledTimes(1);
  expect(onClear).toHaveBeenCalledTimes(1);
});
