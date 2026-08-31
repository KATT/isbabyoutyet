import { expect, test, vi } from "vitest";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { makeResource } from "@workspace/convex/convex/test.resource";
import {
  clearEncouragementMessageDraft,
  readEncouragementMessageDraft,
  writeEncouragementMessageDraft,
} from "@/lib/encouragement-message-draft";

const babyId = "baby_test_1" as Id<"baby">;

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

test("drafts are isolated per baby", async () => {
  await using _storage = sessionStorageResource();
  writeEncouragementMessageDraft("baby_a" as Id<"baby">, "For A");
  writeEncouragementMessageDraft("baby_b" as Id<"baby">, "For B");
  expect(readEncouragementMessageDraft("baby_a" as Id<"baby">)).toBe("For A");
  expect(readEncouragementMessageDraft("baby_b" as Id<"baby">)).toBe("For B");
});

test("write and read round-trip a message draft", async () => {
  await using _storage = sessionStorageResource();
  writeEncouragementMessageDraft(babyId, "Thinking of you all!");
  expect(readEncouragementMessageDraft(babyId)).toBe("Thinking of you all!");
});

test("whitespace-only drafts are not stored", async () => {
  await using _storage = sessionStorageResource();
  writeEncouragementMessageDraft(babyId, "   ");
  expect(readEncouragementMessageDraft(babyId)).toBe("");
});

test("clear removes a stored draft", async () => {
  await using _storage = sessionStorageResource();
  writeEncouragementMessageDraft(babyId, "Draft text");
  clearEncouragementMessageDraft(babyId);
  expect(readEncouragementMessageDraft(babyId)).toBe("");
});

test("expired drafts are dropped on read", async () => {
  await using _storage = sessionStorageResource();
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });
  vi.setSystemTime(new Date("2026-08-30T12:00:00.000Z"));
  writeEncouragementMessageDraft(babyId, "Old draft");
  vi.setSystemTime(new Date("2026-08-31T13:00:00.000Z"));
  expect(readEncouragementMessageDraft(babyId)).toBe("");
});

test("drafts younger than the ttl are kept", async () => {
  await using _storage = sessionStorageResource();
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });
  vi.setSystemTime(new Date("2026-08-30T12:00:00.000Z"));
  writeEncouragementMessageDraft(babyId, "Still fresh");
  vi.setSystemTime(new Date(Date.parse("2026-08-30T12:00:00.000Z") + 24 * 60 * 60 * 1000 - 1));
  expect(readEncouragementMessageDraft(babyId)).toBe("Still fresh");
});
