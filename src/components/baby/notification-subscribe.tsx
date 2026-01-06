import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useConvex, useQuery as useConvexQuery } from "convex/react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";

type NotificationSubscribeProps = {
  babyId: Id<"baby">;
  vapidPublicKey: string;
};

export function NotificationSubscribe(props: NotificationSubscribeProps) {
  const { babyId, vapidPublicKey } = props;
  const convex = useConvex();

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

  // Get browser subscription endpoint
  const pushSubscriptionQuery = useQuery({
    queryKey: ["browserSubscription"],
    queryFn: async () => {
      const registration = await navigator.serviceWorker.ready;
      return await registration.pushManager.getSubscription();
    },
    enabled: isSupported,
  });

  console.log("subscriptionEndpointQuery", pushSubscriptionQuery.data);

  // Check subscription status on server using Convex query (skip in SSR)
  const isSubscribed =
    useConvexQuery(
      api.pushSubscriptions.isSubscribed,
      pushSubscriptionQuery.data
        ? { babyId, endpoint: pushSubscriptionQuery.data.endpoint }
        : "skip",
    ) ?? false;
  // Subscribe mutation (TanStack mutation that handles browser permission + Convex)
  const subscribeMutation = useMutation({
    mutationFn: async () => {
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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={() => {
            if (isSubscribed) {
              if (!pushSubscriptionQuery.data) {
                toast.error("No subscription endpoint found");
                return;
              }
              toast.promise(unsubscribeMutation.mutateAsync(pushSubscriptionQuery.data.endpoint), {
                loading: "Unsubscribing from notifications...",
                success: "Unsubscribed from notifications!",
                error: (error) =>
                  error instanceof Error
                    ? error.message
                    : "Failed to unsubscribe from notifications",
              });
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
          disabled={isLoading || pushSubscriptionQuery.isPending}
          variant={isSubscribed ? "secondary" : "default"}
          size="lg"
        >
          {isSubscribed ? (
            <>
              {isLoading ? <Spinner className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              Unsubscribe
            </>
          ) : (
            <>
              {isLoading ? <Spinner className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              Get Notifications
            </>
          )}
        </Button>
      </TooltipTrigger>
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
