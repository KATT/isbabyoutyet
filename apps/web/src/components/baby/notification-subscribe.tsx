import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Spinner } from "@workspace/ui/components/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useConvex, useQuery as useConvexQuery } from "convex/react";
import { Bell, BellSlash, Export } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { api } from "@workspace/convex/convex/_generated/api";

type NotificationSubscribeProps = {
  babyId: Id<"baby">;
  vapidPublicKey: string;
};

// Detect iOS Safari not running as PWA
function getIOSStatus() {
  if (typeof window === "undefined") return { isIOS: false, isStandalone: false };

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  return { isIOS, isStandalone };
}

// Wait for service worker with timeout
async function waitForServiceWorkerWithTimeout(timeoutMs: number) {
  const timeoutPromise = new Promise<null>((_resolve, reject) => {
    setTimeout(() => reject(new Error("Service worker ready timeout")), timeoutMs);
  });

  return Promise.race([navigator.serviceWorker.ready, timeoutPromise]);
}

export function NotificationSubscribe(props: NotificationSubscribeProps) {
  const { babyId, vapidPublicKey } = props;
  const convex = useConvex();

  // Check iOS status
  const iosStatusQuery = useQuery({
    queryKey: ["iosStatus"],
    queryFn: () => getIOSStatus(),
  });
  const iosStatus = iosStatusQuery.data ?? { isIOS: false, isStandalone: false };
  const needsIOSInstall = iosStatus.isIOS && !iosStatus.isStandalone;

  // Check basic push notification support
  const isSupportedQuery = useQuery({
    queryKey: ["isSupported"],
    queryFn: async () => {
      return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
      );
    },
  });
  const isSupported = isSupportedQuery.data ?? false;

  // Get browser subscription endpoint with timeout
  const pushSubscriptionQuery = useQuery({
    queryKey: ["browserSubscription"],
    queryFn: async () => {
      try {
        const registration = await waitForServiceWorkerWithTimeout(5000);
        if (!registration) return null;
        return await registration.pushManager.getSubscription();
      } catch {
        // Service worker not ready (common on iOS Safari non-PWA)
        return null;
      }
    },
    enabled: isSupported && !needsIOSInstall,
  });

  // Check subscription status on server using Convex query (skip in SSR)
  const isSubscribed = useConvexQuery(
    api.pushSubscriptions.isSubscribed,
    pushSubscriptionQuery.data ? { babyId, endpoint: pushSubscriptionQuery.data.endpoint } : "skip",
  );

  // Subscribe mutation (TanStack mutation that handles browser permission + Convex)
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!isSupported) {
        throw new Error("Push notifications are not supported in this browser.");
      }

      // Request permission
      if (Notification.permission === "default") {
        const permissionResult = await Notification.requestPermission();

        if (permissionResult !== "granted") {
          throw new Error("Notification permission denied");
        }
      } else if (Notification.permission !== "granted") {
        throw new Error("Notification permission is required");
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      // Save subscription to Convex
      const subscriptionData = pushSubscription.toJSON();
      if (
        subscriptionData.endpoint &&
        subscriptionData.keys?.p256dh &&
        subscriptionData.keys?.auth
      ) {
        return await convex.mutation(api.pushSubscriptions.subscribe, {
          babyId,
          endpoint: subscriptionData.endpoint,
          p256dh: subscriptionData.keys.p256dh,
          auth: subscriptionData.keys.auth,
        });
      }

      throw new Error("Failed to get subscription data");
    },
    onSuccess: () => {
      pushSubscriptionQuery.refetch();
    },
  });

  // Unsubscribe mutation (TanStack mutation wrapping Convex mutation)
  const unsubscribeMutation = useMutation({
    mutationFn: async (endpoint: string) => {
      return await convex.mutation(api.pushSubscriptions.unsubscribe, { endpoint });
    },
    onSuccess: () => {
      pushSubscriptionQuery.refetch();
    },
  });

  const isLoading = subscribeMutation.isPending || unsubscribeMutation.isPending;

  // Show iOS installation guide
  if (needsIOSInstall) {
    return (
      <Dialog>
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                render={
                  <Button variant="default" size="lg">
                    <Bell className="w-5 h-5" />
                    Get Notifications
                  </Button>
                }
              />
            }
          />
          <TooltipContent className="max-w-xs">
            <p>
              To receive notifications on iOS, you need to add this page to your home screen first.
              Tap for instructions.
            </p>
          </TooltipContent>
        </Tooltip>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Get Notifications on iOS</DialogTitle>
            <DialogDescription>
              To receive push notifications on iOS, you need to install this app to your home screen
              first.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal list-inside space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="font-medium min-w-5">1.</span>
              <span>
                Tap the <Export className="inline w-4 h-4 mx-1" /> Share button in Safari
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium min-w-5">2.</span>
              <span>Scroll down and tap "Add to Home Screen"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium min-w-5">3.</span>
              <span>Open the app from your home screen</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium min-w-5">4.</span>
              <span>Come back here and tap "Get Notifications"</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            onClick={() => {
              if (isSubscribed) {
                if (!pushSubscriptionQuery.data) {
                  toast.error("No subscription endpoint found");
                  return;
                }
                toast.promise(
                  unsubscribeMutation.mutateAsync(pushSubscriptionQuery.data.endpoint),
                  {
                    loading: "Unsubscribing from notifications...",
                    success: "Unsubscribed from notifications!",
                    error: (error) =>
                      error instanceof Error
                        ? error.message
                        : "Failed to unsubscribe from notifications",
                  },
                );
                pushSubscriptionQuery.refetch();
              } else {
                toast.promise(subscribeMutation.mutateAsync(), {
                  loading: "Subscribing to notifications...",
                  success: "Subscribed to notifications!",
                  error: (error) =>
                    error instanceof Error ? error.message : "Failed to subscribe to notifications",
                });
              }
            }}
            disabled={isLoading}
            variant={isSubscribed ? "secondary" : "default"}
            size="lg"
          >
            {isSubscribed ? (
              <>
                {isLoading ? <Spinner className="w-5 h-5" /> : <BellSlash className="w-5 h-5" />}
                Unsubscribe
              </>
            ) : (
              <>
                {isLoading ? <Spinner className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                Get Notifications
              </>
            )}
          </Button>
        }
      />
      <TooltipContent>
        <p>
          {isSubscribed
            ? "Stop receiving push notifications for updates"
            : "Get notified when the baby's status changes"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// Convert VAPID key from base64 URL to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
