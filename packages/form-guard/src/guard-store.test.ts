import { expect, test, vi } from "vitest";
import { createFormGuardStore } from "./guard-store.js";
import type { FormGuardStore, OverlayDismissEventDetails } from "./guard-store.js";

function dismissEvent(reason: string) {
  const cancel = vi.fn();
  const eventDetails: OverlayDismissEventDetails = { reason, cancel };
  return { eventDetails, cancel };
}

function attachActions(store: FormGuardStore) {
  const close = vi.fn();
  store.actionsRef.current = { close, unmount: () => undefined };
  return close;
}

test("clean store allows user dismissal without cancelling", () => {
  const store = createFormGuardStore();
  const { eventDetails, cancel } = dismissEvent("escape-key");

  expect(store.handleOpenChange(false, eventDetails)).toBe("allow");
  expect(cancel).not.toHaveBeenCalled();
  expect(store.isPromptOpen()).toBe(false);
});

test("submit lock blocks user dismissal but not the imperative success-close", () => {
  const store = createFormGuardStore();
  store.acquireSubmitLock();
  store.acquireSubmitLock();
  store.releaseSubmitLock();

  const escape = dismissEvent("escape-key");
  expect(store.handleOpenChange(false, escape.eventDetails)).toBe("block");
  expect(escape.cancel).toHaveBeenCalled();

  const imperative = dismissEvent("imperative-action");
  expect(store.handleOpenChange(false, imperative.eventDetails)).toBe("allow");
  expect(imperative.cancel).not.toHaveBeenCalled();

  store.releaseSubmitLock();
  const idle = dismissEvent("escape-key");
  expect(store.handleOpenChange(false, idle.eventDetails)).toBe("allow");
});

test("dirty store confirms dismissal and opens its own prompt", () => {
  const store = createFormGuardStore();
  store.setDirty("note", true);

  const { eventDetails, cancel } = dismissEvent("outside-press");
  expect(store.handleOpenChange(false, eventDetails)).toBe("confirm");
  expect(cancel).toHaveBeenCalled();
  expect(store.isPromptOpen()).toBe(true);
});

test("keep editing closes the prompt without closing the overlay", () => {
  const store = createFormGuardStore();
  const close = attachActions(store);
  store.setDirty("note", true);
  store.handleOpenChange(false, dismissEvent("escape-key").eventDetails);

  store.keepEditing();
  expect(store.isPromptOpen()).toBe(false);
  expect(close).not.toHaveBeenCalled();
  expect(store.isDirty()).toBe(true);
});

test("discard allows leaving and closes every queued target", () => {
  const store = createFormGuardStore();
  const close = attachActions(store);
  store.setDirty("note", true);
  store.handleOpenChange(false, dismissEvent("escape-key").eventDetails);

  store.discard();
  expect(store.isPromptOpen()).toBe(false);
  expect(close).toHaveBeenCalled();
  expect(store.isDirty()).toBe(false);
});

test("allowLeave lets a dismiss through and re-dirtying re-arms the guard", () => {
  const store = createFormGuardStore();
  store.setDirty("note", true);
  store.allowLeave();
  expect(store.isDirty()).toBe(false);
  expect(store.handleOpenChange(false, dismissEvent("escape-key").eventDetails)).toBe("allow");

  store.revokeAllowLeave();
  expect(store.isDirty()).toBe(true);

  store.allowLeave();
  store.setDirty("note", false);
  store.setDirty("note", true);
  expect(store.isDirty()).toBe(true);
});

test("a nested dirty store routes its prompt to the stack root", () => {
  const root = createFormGuardStore();
  const child = createFormGuardStore();
  const rootClose = attachActions(root);
  const childClose = attachActions(child);
  child.setAncestors([root]);
  child.setDirty("note", true);
  root.setDirty("note", true);

  // One backdrop click dismisses both popups: child outside-press first…
  expect(child.handleOpenChange(false, dismissEvent("outside-press").eventDetails)).toBe("confirm");
  // …then the parent's own dismissal; both queue on the root's single prompt.
  expect(root.handleOpenChange(false, dismissEvent("outside-press").eventDetails)).toBe("confirm");
  expect(root.isPromptOpen()).toBe(true);
  expect(child.isPromptOpen()).toBe(false);

  root.discard();
  expect(childClose).toHaveBeenCalled();
  expect(rootClose).toHaveBeenCalled();
});

test("keep editing on the root clears queued nested targets", () => {
  const root = createFormGuardStore();
  const child = createFormGuardStore();
  const rootClose = attachActions(root);
  const childClose = attachActions(child);
  child.setAncestors([root]);
  child.setDirty("note", true);

  child.handleOpenChange(false, dismissEvent("outside-press").eventDetails);
  expect(root.isPromptOpen()).toBe(true);

  root.keepEditing();
  expect(root.isPromptOpen()).toBe(false);
  expect(childClose).not.toHaveBeenCalled();
  expect(rootClose).not.toHaveBeenCalled();

  // The child is still guarded for the next dismissal.
  expect(child.handleOpenChange(false, dismissEvent("escape-key").eventDetails)).toBe("confirm");
});

test("prompt subscribers are notified on open and close, and can unsubscribe", () => {
  const store = createFormGuardStore();
  const listener = vi.fn();
  const unsubscribe = store.subscribe(listener);
  store.setDirty("note", true);

  store.handleOpenChange(false, dismissEvent("escape-key").eventDetails);
  expect(listener).toHaveBeenCalledTimes(1);

  store.keepEditing();
  expect(listener).toHaveBeenCalledTimes(2);

  unsubscribe();
  store.handleOpenChange(false, dismissEvent("escape-key").eventDetails);
  expect(listener).toHaveBeenCalledTimes(2);
});

test("close without an attached overlay is a no-op", () => {
  const store = createFormGuardStore();
  expect(() => {
    store.close();
  }).not.toThrow();
});
