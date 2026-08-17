/**
 * Service-worker registration is application bootstrap work, not render state.
 * Import this module once from the root route.
 */
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      console.log("Service Worker registered:", registration);
    })
    .catch((error: unknown) => {
      console.error("Service Worker registration failed:", error);
    });
}
