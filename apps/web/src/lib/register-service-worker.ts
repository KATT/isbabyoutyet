/**
 * Service-worker registration is application bootstrap work, not render state.
 * Import this module once from the root route.
 */

/** @internal Keeps this file a module under `noUncheckedSideEffectImports`. */
export const serviceWorkerRegistered = true;

if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      console.log("Service Worker registered:", registration);
    })
    .catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
}
