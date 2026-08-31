import { webcrypto } from "node:crypto";

import { makeResource } from "@workspace/convex/convex/test.resource";
import { isFunction, isPlainObject, isString } from "@workspace/runtime/guards";
import { expect, test, vi } from "vitest";
import { stubJsdomWindow } from "@/test/stubJsdomWindow";

function betterAuthHostCleanup(symbolName: string) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, Symbol.for(symbolName));
  const stub = descriptor?.value;
  if (!isPlainObject(stub)) {
    throw new Error(`${symbolName} stub is missing`);
  }
  const setup = stub.setup;
  if (!isFunction(setup)) {
    throw new Error(`${symbolName} stub is missing setup`);
  }
  const cleanup = setup();
  if (!isFunction(cleanup)) {
    throw new Error(`${symbolName} setup did not return a cleanup`);
  }
  return cleanup;
}

class CallerObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function callerMatchMedia(query: string) {
  return {
    matches: true,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  };
}

function restoreNamedDescriptor(options: {
  target: object;
  key: string;
  descriptor: PropertyDescriptor | undefined;
}) {
  if (options.descriptor) {
    Object.defineProperty(options.target, options.key, options.descriptor);
    return;
  }
  Reflect.deleteProperty(options.target, options.key);
}

async function notImplementedMessages(run: () => void) {
  const spy = vi.spyOn(console, "error");
  await using _spy = makeResource({}, () => {
    spy.mockRestore();
  });
  run();
  return spy.mock.calls
    .map((call) => call[0])
    .filter((message) => isString(message) && message.startsWith("Not implemented:"));
}

test("window scroll APIs stay quiet while stubJsdomWindow is held", async () => {
  await using _window = stubJsdomWindow();
  expect(
    await notImplementedMessages(() => {
      window.scrollTo(0, 0);
      window.scrollTo({ top: 0, behavior: "auto" });
      window.scroll(0, 0);
      window.scrollBy(0, 10);
    }),
  ).toEqual([]);
});

test("location reload and href assignment stay on this document", async () => {
  await using _window = stubJsdomWindow();
  const href = window.location.href;
  expect(
    await notImplementedMessages(() => {
      window.location.reload();
      window.location.assign("/elsewhere");
      window.location.replace("/elsewhere");
      window.location.href = "/elsewhere";
    }),
  ).toEqual([]);
  expect(window.location.href).toBe(href);
});

test("nested stubJsdomWindow keeps stubs until the last resource disposes", async () => {
  await using _outer = stubJsdomWindow();
  {
    await using _inner = stubJsdomWindow();
    expect(await notImplementedMessages(() => window.scrollTo(0, 0))).toEqual([]);
  }
  expect(await notImplementedMessages(() => window.scrollTo(0, 0))).toEqual([]);
});

test("restores the previous window.scrollTo after dispose", async () => {
  const original = window.scrollTo;
  {
    await using _window = stubJsdomWindow();
    expect(window.scrollTo).not.toBe(original);
    expect(await notImplementedMessages(() => window.scrollTo(0, 0))).toEqual([]);
  }
  expect(window.scrollTo).toBe(original);
});

test("element scroll APIs stay quiet while stubJsdomWindow is held", async () => {
  await using _window = stubJsdomWindow();
  const element = document.createElement("div");
  document.body.append(element);
  await using _element = makeResource({}, () => {
    element.remove();
  });
  expect(
    await notImplementedMessages(() => {
      element.scrollIntoView();
      element.scrollTo(0, 0);
    }),
  ).toEqual([]);
});

test("crypto.subtle.digest hashes ArrayBuffer and typed-array views", async () => {
  await using _window = stubJsdomWindow();
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const expected = new Uint8Array(await webcrypto.subtle.digest("SHA-256", bytes));
  const fromView = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const fromBuffer = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.buffer));
  expect(fromView).toEqual(expected);
  expect(fromBuffer).toEqual(expected);
});

test("does not replace caller-provided matchMedia or observers", async () => {
  const previousMatchMedia = Object.getOwnPropertyDescriptor(globalThis, "matchMedia");
  const previousIntersectionObserver = Object.getOwnPropertyDescriptor(
    globalThis,
    "IntersectionObserver",
  );
  const previousResizeObserver = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  const previousElementScrollTo = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTo");
  const previousScrollIntoView = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "scrollIntoView",
  );
  const callerElementScrollTo = () => {};
  const callerScrollIntoView = () => {};

  vi.stubGlobal("matchMedia", callerMatchMedia);
  vi.stubGlobal("IntersectionObserver", CallerObserver);
  vi.stubGlobal("ResizeObserver", CallerObserver);
  Element.prototype.scrollTo = callerElementScrollTo;
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: callerScrollIntoView,
  });

  await using _restoreCallers = makeResource({}, () => {
    restoreNamedDescriptor({
      target: globalThis,
      key: "matchMedia",
      descriptor: previousMatchMedia,
    });
    restoreNamedDescriptor({
      target: globalThis,
      key: "IntersectionObserver",
      descriptor: previousIntersectionObserver,
    });
    restoreNamedDescriptor({
      target: globalThis,
      key: "ResizeObserver",
      descriptor: previousResizeObserver,
    });
    restoreNamedDescriptor({
      target: Element.prototype,
      key: "scrollTo",
      descriptor: previousElementScrollTo,
    });
    restoreNamedDescriptor({
      target: Element.prototype,
      key: "scrollIntoView",
      descriptor: previousScrollIntoView,
    });
  });

  {
    await using _window = stubJsdomWindow();
    expect(globalThis.matchMedia).toBe(callerMatchMedia);
    expect(globalThis.IntersectionObserver).toBe(CallerObserver);
    expect(globalThis.ResizeObserver).toBe(CallerObserver);
    expect(Element.prototype.scrollTo).toBe(callerElementScrollTo);
    expect(Element.prototype.scrollIntoView).toBe(callerScrollIntoView);
  }

  expect(globalThis.matchMedia).toBe(callerMatchMedia);
  expect(globalThis.IntersectionObserver).toBe(CallerObserver);
  expect(globalThis.ResizeObserver).toBe(CallerObserver);
  expect(Element.prototype.scrollTo).toBe(callerElementScrollTo);
  expect(Element.prototype.scrollIntoView).toBe(callerScrollIntoView);
});

test("restore is safe to call twice and still allows a later install", async () => {
  const original = window.scrollTo;
  const first = stubJsdomWindow();
  first.restore();
  first.restore();
  expect(window.scrollTo).toBe(original);

  await using _second = stubJsdomWindow();
  expect(window.scrollTo).not.toBe(original);
  expect(await notImplementedMessages(() => window.scrollTo(0, 0))).toEqual([]);
});

test("better-auth leftover session-refresh cleanup is a no-op without document", async () => {
  const documentAdd = vi.spyOn(document, "addEventListener");
  const documentRemove = vi.spyOn(document, "removeEventListener");
  const windowAdd = vi.spyOn(window, "addEventListener");
  const windowRemove = vi.spyOn(window, "removeEventListener");
  await using _spies = makeResource({}, () => {
    documentAdd.mockRestore();
    documentRemove.mockRestore();
    windowAdd.mockRestore();
    windowRemove.mockRestore();
  });

  const cleanups = [
    betterAuthHostCleanup("better-auth:broadcast-channel"),
    betterAuthHostCleanup("better-auth:focus-manager"),
    betterAuthHostCleanup("better-auth:online-manager"),
  ];

  expect(documentAdd).not.toHaveBeenCalled();
  expect(windowAdd).not.toHaveBeenCalled();

  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  if (!previousDocument) {
    throw new Error("expected jsdom document");
  }
  await using _restoreDocument = makeResource({}, () => {
    Object.defineProperty(globalThis, "document", previousDocument);
  });
  // @ts-expect-error — simulate vitest tearing down jsdom before nanostores unmount
  delete globalThis.document;

  for (const cleanup of cleanups) {
    cleanup();
  }

  expect(documentRemove).not.toHaveBeenCalled();
  expect(windowRemove).not.toHaveBeenCalled();
});
