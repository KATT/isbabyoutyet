import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { useEncouragementMessageDraft } from "@/lib/use-encouragement-message-draft";

const babyId = "baby_test_2" as Id<"baby">;

function sessionStorageResource() {
  const store = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
  vi.stubGlobal("sessionStorage", storage);
  return makeResource(store, () => {
    vi.unstubAllGlobals();
  });
}

test("shows a restored hint when initialRestored is true", async () => {
  await using _storage = sessionStorageResource();
  const hook = renderHook(() =>
    useEncouragementMessageDraft({
      babyId,
      message: "Hello",
      initialRestored: true,
    }),
  );
  await using _hook = makeResource({}, () => hook.unmount());
  expect(hook.result.current.showRestoredHint).toBe(true);
});

test("debounces draft writes to sessionStorage", async () => {
  await using _storage = sessionStorageResource();
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });

  const hook = renderHook(
    (props) =>
      useEncouragementMessageDraft({
        babyId,
        message: props.message,
        initialRestored: false,
      }),
    { initialProps: { message: "" } },
  );
  await using _hook = makeResource({}, () => hook.unmount());

  act(() => hook.rerender({ message: "Draft" }));
  expect(sessionStorage.getItem(`encouragement-message-draft:${babyId}`)).toBeNull();

  act(() => vi.advanceTimersByTime(500));
  const stored = sessionStorage.getItem(`encouragement-message-draft:${babyId}`);
  expect(stored).toBeTruthy();
  if (!stored) {
    throw new Error("expected draft in sessionStorage");
  }
  expect(JSON.parse(stored).message).toBe("Draft");
});

test("clearDraft removes storage and hides the hint", async () => {
  await using _storage = sessionStorageResource();
  writeDraftToStorage(babyId, "Saved");
  const hook = renderHook(() =>
    useEncouragementMessageDraft({
      babyId,
      message: "Saved",
      initialRestored: true,
    }),
  );
  await using _hook = makeResource({}, () => hook.unmount());

  act(() => hook.result.current.clearDraft());
  expect(hook.result.current.showRestoredHint).toBe(false);
  expect(sessionStorage.getItem(`encouragement-message-draft:${babyId}`)).toBeNull();
});

function writeDraftToStorage(id: Id<"baby">, message: string) {
  sessionStorage.setItem(
    `encouragement-message-draft:${id}`,
    JSON.stringify({ message, savedAt: Date.now() }),
  );
}
