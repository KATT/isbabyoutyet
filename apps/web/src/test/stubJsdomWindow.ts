/**
 * jsdom is missing (or only "Not implemented") a handful of Window APIs that
 * real components need: next-themes `matchMedia`, observer-based layout,
 * TanStack Router scroll restoration, Paraglide `location.reload()`, and
 * convex-test Blob hashing through SubtleCrypto.
 *
 * Module mocks (`vi.mock`) stay banned. `vi.stubGlobal` / `vi.spyOn` are the
 * allowed exception for these third-party host APIs. Prefer `await using` on
 * `stubJsdomWindow()`, or go through `renderResource` / the router and Convex
 * test helpers so most tests never call this directly.
 *
 * This file is also a Vitest `setupFiles` entry so better-auth's broadcast
 * channel is replaced *before* that package loads. Window stubs are not
 * installed at import time.
 */

import { webcrypto } from "node:crypto";

import { makeResource } from "@workspace/convex/convex/test.resource";
import { isFunction, isPlainObject } from "@workspace/runtime/guards";
import { vi } from "vitest";

const kAuthBroadcastChannel = Symbol.for("better-auth:broadcast-channel");

class StubAuthBroadcastChannel {
  subscribe() {
    return () => {};
  }

  post() {}

  setup() {
    return () => {};
  }
}

// better-auth's default channel cleanup calls window.removeEventListener after
// jsdom tears down, which vitest reports as an unhandled error. Never restore:
// leftover session-refresh cleanup must keep hitting this no-op.
Object.assign(globalThis, { [kAuthBroadcastChannel]: new StubAuthBroadcastChannel() });

class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function stubMatchMedia(query: string) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  };
}

function stubWindowScroll() {}

function jsdomLocationInternals() {
  for (const symbol of Object.getOwnPropertySymbols(window.location)) {
    const candidate = Object.getOwnPropertyDescriptor(window.location, symbol)?.value;
    if (
      isPlainObject(candidate) &&
      isFunction(candidate.reload) &&
      isFunction(candidate.assign) &&
      isFunction(candidate.replace)
    ) {
      return candidate;
    }
  }
  throw new Error("jsdom Location internals were not found");
}

function patchJsdomLocation() {
  const internals = jsdomLocationInternals();
  const previousReload = internals.reload;
  const previousAssign = internals.assign;
  const previousReplace = internals.replace;
  const previousNavigate = Object.getOwnPropertyDescriptor(internals, "_locationObjectNavigate");

  internals.reload = stubWindowScroll;
  internals.assign = stubWindowScroll;
  internals.replace = stubWindowScroll;
  Object.defineProperty(internals, "_locationObjectNavigate", {
    configurable: true,
    writable: true,
    value: stubWindowScroll,
  });

  return () => {
    internals.reload = previousReload;
    internals.assign = previousAssign;
    internals.replace = previousReplace;
    if (previousNavigate) {
      Object.defineProperty(internals, "_locationObjectNavigate", previousNavigate);
    } else {
      Reflect.deleteProperty(internals, "_locationObjectNavigate");
    }
  };
}

function digestBytes(data: BufferSource) {
  if (data instanceof ArrayBuffer) {
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(new Uint8Array(data));
    return bytes;
  }
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  return bytes;
}

function patchCryptoSubtle() {
  const subtle = globalThis.crypto.subtle;
  const previousDigest = subtle.digest.bind(subtle);
  const nodeDigest = webcrypto.subtle.digest.bind(webcrypto.subtle);
  subtle.digest = (algorithm, data) => nodeDigest(algorithm, digestBytes(data));
  return () => {
    subtle.digest = previousDigest;
  };
}

let installCount = 0;
let restoreInstalled: (() => void) | null = null;

function installJsdomWindowStubs() {
  const previousMatchMedia = globalThis.matchMedia;
  const previousIntersectionObserver = globalThis.IntersectionObserver;
  const previousResizeObserver = globalThis.ResizeObserver;
  const previousScrollTo = window.scrollTo;
  const previousScroll = window.scroll;
  const previousScrollBy = window.scrollBy;
  const previousElementScrollTo = Element.prototype.scrollTo;
  const previousScrollIntoView = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "scrollIntoView",
  );
  const addedElementScrollTo = !isFunction(previousElementScrollTo);

  vi.stubGlobal("matchMedia", stubMatchMedia);
  vi.stubGlobal("IntersectionObserver", StubObserver);
  vi.stubGlobal("ResizeObserver", StubObserver);
  vi.stubGlobal("scrollTo", stubWindowScroll);
  vi.stubGlobal("scroll", stubWindowScroll);
  vi.stubGlobal("scrollBy", stubWindowScroll);

  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: stubWindowScroll,
  });
  if (addedElementScrollTo) {
    Element.prototype.scrollTo = stubWindowScroll;
  }

  const restoreLocation = patchJsdomLocation();
  const restoreCrypto = patchCryptoSubtle();

  return () => {
    restoreCrypto();
    restoreLocation();
    if (addedElementScrollTo) {
      Reflect.deleteProperty(Element.prototype, "scrollTo");
    }
    if (previousScrollIntoView) {
      Object.defineProperty(Element.prototype, "scrollIntoView", previousScrollIntoView);
    } else {
      Reflect.deleteProperty(Element.prototype, "scrollIntoView");
    }
    vi.stubGlobal("matchMedia", previousMatchMedia);
    vi.stubGlobal("IntersectionObserver", previousIntersectionObserver);
    vi.stubGlobal("ResizeObserver", previousResizeObserver);
    vi.stubGlobal("scrollTo", previousScrollTo);
    vi.stubGlobal("scroll", previousScroll);
    vi.stubGlobal("scrollBy", previousScrollBy);
  };
}

function acquireJsdomWindowStubs() {
  if (installCount === 0) {
    restoreInstalled = installJsdomWindowStubs();
  }
  installCount += 1;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    installCount -= 1;
    if (installCount === 0) {
      restoreInstalled?.();
      restoreInstalled = null;
    }
  };
}

/**
 * Installs jsdom host-API stubs for the lifetime of the returned resource.
 * Nested calls share one install (refcount); restoring is idempotent.
 */
export function stubJsdomWindow() {
  const restore = acquireJsdomWindowStubs();
  return makeResource({ restore }, restore);
}
