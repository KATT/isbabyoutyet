import { queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { InitiatedQuery } from "@workspace/query-prefetch";
import { getQueryInitiator } from "@workspace/query-prefetch";

export type BrowserPushCapability =
  | { kind: "unsupported" }
  | { kind: "needsIosInstall" }
  | { kind: "serviceWorkerTimeout" }
  | { kind: "unsubscribed" }
  | { kind: "subscribed"; subscription: PushSubscription };

const browserPushCapabilityQueryKey = ["browserPushCapability"] as const;

const SERVICE_WORKER_READY_TIMEOUT_MS = 5000;
const SERVICE_WORKER_READY_TIMEOUT_MESSAGE = "Service worker ready timeout";

export function browserPushCapability() {
  return queryOptions({
    queryKey: browserPushCapabilityQueryKey,
    queryFn: resolveBrowserPushCapability,
    enabled: typeof window !== "undefined",
  });
}

export function prefetchBrowserPushCapability(
  queryClient: QueryClient,
): InitiatedQuery<typeof browserPushCapability> {
  if (typeof window === "undefined") {
    return { input: undefined } as InitiatedQuery<typeof browserPushCapability>;
  }
  return getQueryInitiator(queryClient).ensureQueryData(browserPushCapability);
}

function getIOSStatus() {
  if (typeof window === "undefined") {
    return { isIOS: false, isStandalone: false };
  }

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream: unknown | undefined }).MSStream;
  if (!isIOS) {
    return { isIOS: false, isStandalone: false };
  }

  const isStandalone =
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as unknown as { standalone: boolean | undefined }).standalone === true;

  return { isIOS: true, isStandalone };
}

function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function waitForServiceWorkerWithTimeout(timeoutMs: number) {
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new Error(SERVICE_WORKER_READY_TIMEOUT_MESSAGE)), timeoutMs);
  });

  return Promise.race([navigator.serviceWorker.ready, timeoutPromise]);
}

async function resolveBrowserPushCapability(): Promise<BrowserPushCapability> {
  const iosStatus = getIOSStatus();
  if (iosStatus.isIOS && !iosStatus.isStandalone) {
    return { kind: "needsIosInstall" };
  }

  if (!isPushSupported()) {
    return { kind: "unsupported" };
  }

  try {
    const registration = await waitForServiceWorkerWithTimeout(SERVICE_WORKER_READY_TIMEOUT_MS);
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      return { kind: "subscribed", subscription };
    }
    return { kind: "unsubscribed" };
  } catch (error) {
    if (error instanceof Error && error.message === SERVICE_WORKER_READY_TIMEOUT_MESSAGE) {
      return { kind: "serviceWorkerTimeout" };
    }
    // Service worker not ready (common on iOS Safari non-PWA)
    return { kind: "unsubscribed" };
  }
}
