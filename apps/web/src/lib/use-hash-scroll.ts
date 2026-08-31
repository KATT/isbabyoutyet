import { useEffect, useRef } from "react";
import { isFunction, isPlainObject } from "@workspace/runtime/guards";
import { NOTIFICATION_CLICK_MESSAGE } from "@/lib/notification-click";

/**
 * Scrolls to `location.hash` on load, hashchange, and service-worker
 * notification-click messages. Owns those window subscriptions so feature
 * routes stay free of effects.
 */
export function useHashScroll() {
  const scrollToHashRef = useRef(() => {});
  scrollToHashRef.current = () => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) {
      return;
    }
    const landmark = document.getElementById(hash);
    if (!landmark) {
      return;
    }
    const reducedMotion =
      isFunction(window.matchMedia) &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    landmark.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  useEffect(() => {
    scrollToHashRef.current();
    function onHashChange() {
      scrollToHashRef.current();
    }
    function onMessage(event: MessageEvent) {
      if (!isPlainObject(event.data)) {
        return;
      }
      if (event.data.type === NOTIFICATION_CLICK_MESSAGE) {
        scrollToHashRef.current();
      }
    }
    window.addEventListener("hashchange", onHashChange);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);
}
