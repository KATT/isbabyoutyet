/**
 * jsdom is missing a handful of browser APIs that real components we render
 * in tests rely on (embla-carousel, next-themes, base-ui's anchor
 * positioning, our own IntersectionObserver-based infinite scroll). Stub
 * them globally so components can run unmocked under test.
 */

import { webcrypto } from "node:crypto";

import { isFunction } from "@workspace/convex/src/runtimeGuards";

// jsdom's SubtleCrypto rejects ArrayBuffers from Blob#arrayBuffer(); route storage
// hashing in convex-test through Node's webcrypto instead.
const nodeDigest = webcrypto.subtle.digest.bind(webcrypto.subtle);
const subtle = globalThis.crypto.subtle;
subtle.digest = (algorithm, data) => {
  const view =
    data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : ArrayBuffer.isView(data)
        ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        : new Uint8Array(data as ArrayBufferLike);
  const bytes = new Uint8Array(view.byteLength);
  bytes.set(view);
  return nodeDigest(algorithm, bytes);
};

if (!isFunction(window.matchMedia)) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

if (!isFunction(window.IntersectionObserver)) {
  window.IntersectionObserver = StubObserver as unknown as typeof IntersectionObserver;
}

if (!isFunction(window.ResizeObserver)) {
  window.ResizeObserver = StubObserver as unknown as typeof ResizeObserver;
}

// jsdom leaves Element#scrollIntoView unimplemented; coachmarks / tour targets
// call it and would otherwise throw into the router error boundary.
function stubScrollIntoView(this: Element) {}
if (!isFunction(Element.prototype.scrollIntoView)) {
  Element.prototype.scrollIntoView = stubScrollIntoView;
}
