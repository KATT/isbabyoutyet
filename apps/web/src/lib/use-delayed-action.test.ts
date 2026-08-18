import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { useDelayedAction } from "./use-delayed-action";

test("runs an enabled action after the delay and cancels when disabled", async () => {
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => vi.useRealTimers());
  const action = vi.fn<() => void>();
  const hook = renderHook(
    (props: { enabled: boolean }) =>
      useDelayedAction({
        action,
        delayMs: 4000,
        enabled: props.enabled,
      }),
    { initialProps: { enabled: true } },
  );
  await using _hook = makeResource({}, () => hook.unmount());

  act(() => vi.advanceTimersByTime(3999));
  expect(action).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(action).toHaveBeenCalledOnce();

  action.mockClear();
  hook.rerender({ enabled: false });
  hook.rerender({ enabled: true });
  hook.rerender({ enabled: false });
  act(() => vi.advanceTimersByTime(4000));
  expect(action).not.toHaveBeenCalled();
});
