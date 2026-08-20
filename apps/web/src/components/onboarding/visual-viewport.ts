import { useSyncExternalStore } from "react";
import type { CSSProperties } from "react";

function subscribeToVisualViewport(onStoreChange: () => void) {
  const viewport = window.visualViewport;
  window.addEventListener("resize", onStoreChange);
  viewport?.addEventListener("resize", onStoreChange);
  viewport?.addEventListener("scroll", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
    viewport?.removeEventListener("resize", onStoreChange);
    viewport?.removeEventListener("scroll", onStoreChange);
  };
}

function getVisualViewportBottomOffset() {
  const viewport = window.visualViewport;
  if (!viewport) {
    return 0;
  }
  return Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height);
}

function getServerVisualViewportBottomOffset() {
  return 0;
}

export function useVisualViewportBottom() {
  const offset = useSyncExternalStore(
    subscribeToVisualViewport,
    getVisualViewportBottomOffset,
    getServerVisualViewportBottomOffset,
  );
  const style = {
    "--visual-viewport-bottom": `${offset}px`,
  } as CSSProperties;
  return [offset, style] as const;
}
