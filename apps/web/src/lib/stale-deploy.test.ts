import { expect, test, vi } from "vitest";
import { bindHardNavigation, bindStaleReloadTriggers } from "./stale-deploy";
import type { StaleDeployRouter } from "./stale-deploy";

test("bindHardNavigation forces document reloads on href-changing navigations", () => {
  const assignLocation = vi.fn<(href: string) => void>();
  const captured: { listener: Parameters<StaleDeployRouter["subscribe"]>[1] | null } = {
    listener: null,
  };
  const unsubscribe = vi.fn<() => void>();
  const router = {
    subscribe: vi.fn<StaleDeployRouter["subscribe"]>((_eventName, nextListener) => {
      captured.listener = nextListener;
      return unsubscribe;
    }),
  };

  const stop = bindHardNavigation(router, assignLocation);
  const listener = captured.listener;
  if (!listener) {
    throw new Error("expected onBeforeNavigate listener");
  }

  listener({ hrefChanged: false, toLocation: { href: "/dashboard" } });
  expect(assignLocation).not.toHaveBeenCalled();

  listener({ hrefChanged: true, toLocation: { href: "/dashboard" } });
  expect(assignLocation).toHaveBeenCalledWith("/dashboard");

  stop();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test("bindStaleReloadTriggers reloads when the app becomes visible or is restored from bfcache", () => {
  const reload = vi.fn<() => void>();
  const documentListeners = new Map<string, (event: Event) => void>();
  const windowListeners = new Map<string, (event: Event) => void>();

  const documentTarget = {
    visibilityState: "hidden",
    addEventListener: (type: string, listener: (event: Event) => void) => {
      documentListeners.set(type, listener);
    },
    removeEventListener: (type: string) => {
      documentListeners.delete(type);
    },
  };
  const windowTarget = {
    addEventListener: (type: string, listener: (event: Event) => void) => {
      windowListeners.set(type, listener);
    },
    removeEventListener: (type: string) => {
      windowListeners.delete(type);
    },
  };

  const stop = bindStaleReloadTriggers({
    reload,
    document: documentTarget,
    window: windowTarget,
  });

  documentListeners.get("visibilitychange")?.(new Event("visibilitychange"));
  expect(reload).not.toHaveBeenCalled();

  documentTarget.visibilityState = "visible";
  documentListeners.get("visibilitychange")?.(new Event("visibilitychange"));
  expect(reload).toHaveBeenCalledTimes(1);

  windowListeners.get("pageshow")?.(new Event("pageshow"));
  expect(reload).toHaveBeenCalledTimes(1);

  const persisted = new Event("pageshow") as Event & { persisted: boolean };
  persisted.persisted = true;
  windowListeners.get("pageshow")?.(persisted);
  expect(reload).toHaveBeenCalledTimes(2);

  stop();
  expect(documentListeners.has("visibilitychange")).toBe(false);
  expect(windowListeners.has("pageshow")).toBe(false);
});
