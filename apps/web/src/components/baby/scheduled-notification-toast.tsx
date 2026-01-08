import { Button } from "@workspace/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item";
import { Spinner } from "@workspace/ui/components/spinner";
import { useMutation as useTanstackMutation } from "@tanstack/react-query";
import { useConvex, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { api } from "@workspace/convex/convex/_generated/api";
import { Check, X } from "lucide-react";

type ScheduledNotificationToastProps = {
  babyId: Id<"baby">;
};

export function ScheduledNotificationToast(props: ScheduledNotificationToastProps) {
  const notifications = useQuery(api.baby.getScheduledNotifications, { babyId: props.babyId });
  const pendingNotifications = useMemo(
    () => notifications?.filter((n) => n.status === "pending") ?? [],
    [notifications],
  );
  const subscriptions = useQuery(api.pushSubscriptions.getSubscriptions, { babyId: props.babyId });

  const subscriptionCount = subscriptions?.length ?? 0;

  // Track active toasts and previous notification states
  const activeToasts = useRef(new Set<Id<"scheduledNotifications">>());
  const previousPendingIds = useRef(new Set<Id<"scheduledNotifications">>());

  useEffect(() => {
    if (!notifications) return;

    // Don't show any toasts if there are no subscribers
    if (subscriptionCount === 0) {
      // Dismiss any existing toasts
      for (const id of activeToasts.current) {
        toast.dismiss(id);
      }
      activeToasts.current.clear();
      previousPendingIds.current.clear();
      return;
    }

    const currentPendingIds = new Set(pendingNotifications.map((n) => n._id));

    // Check for notifications that were pending but are now sent
    for (const id of previousPendingIds.current) {
      if (!currentPendingIds.has(id)) {
        const notification = notifications.find((n) => n._id === id);
        if (notification?.status === "sent") {
          // Dismiss the countdown toast and show success
          toast.dismiss(id);
          activeToasts.current.delete(id);
          toast.custom(
            () => (
              <Item variant="outline" className="min-w-[300px] border-green-500/50 shadow-lg">
                <ItemMedia className="size-10 rounded-full bg-green-500/10">
                  <Check className="size-5 text-green-500" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Notification sent!</ItemTitle>
                  <ItemDescription>
                    {getNotificationTypeLabel(notification.notificationType)} · {subscriptionCount}{" "}
                    {subscriptionCount === 1 ? "person" : "people"}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ),
            { duration: 4000 },
          );
        } else {
          // Just dismiss if cancelled or other status
          toast.dismiss(id);
          activeToasts.current.delete(id);
        }
      }
    }

    // Update previous pending IDs for next comparison
    previousPendingIds.current = currentPendingIds;

    // Create toasts for new pending notifications
    for (const notification of pendingNotifications) {
      if (!activeToasts.current.has(notification._id)) {
        activeToasts.current.add(notification._id);
        toast.custom(
          () => (
            <NotificationToastContent
              notificationId={notification._id}
              notificationType={notification.notificationType}
              scheduledFor={notification.scheduledFor}
              subscriptionCount={subscriptionCount}
            />
          ),
          {
            id: notification._id,
            duration: Infinity,
          },
        );
      }
    }
  }, [notifications, pendingNotifications, subscriptionCount]);

  // Cleanup on unmount
  useEffect(() => {
    const toasts = activeToasts.current;
    return () => {
      for (const id of toasts) {
        toast.dismiss(id);
      }
    };
  }, []);

  return null;
}

type NotificationToastContentProps = {
  notificationId: Id<"scheduledNotifications">;
  notificationType: "labor_started" | "gone_to_hospital" | "born" | "photo_added";
  scheduledFor: number;
  subscriptionCount: number;
};

function NotificationToastContent(props: NotificationToastContentProps) {
  const convex = useConvex();
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.ceil((props.scheduledFor - Date.now()) / 1000)),
  );

  const cancelMutation = useTanstackMutation({
    mutationFn: async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      await convex.mutation(api.baby.cancelScheduledNotification, {
        notificationId: props.notificationId,
      });
    },
    onSuccess: () => {
      toast.dismiss(props.notificationId);
      toast.success("Notification cancelled");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to cancel notification");
    },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((props.scheduledFor - Date.now()) / 1000));
      setSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [props.scheduledFor]);

  return (
    <Item variant="outline" className="min-w-[300px] shadow-lg bg-background">
      <ItemMedia className="size-10 rounded-full bg-primary/10 tabular-nums text-lg font-semibold text-primary">
        {seconds}
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Sending notification...</ItemTitle>
        <ItemDescription>
          {getNotificationTypeLabel(props.notificationType)} · {props.subscriptionCount}{" "}
          {props.subscriptionCount === 1 ? "person" : "people"}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          variant="outline"
          size="sm"
          disabled={cancelMutation.isPending}
          onClick={() => cancelMutation.mutate()}
        >
          {cancelMutation.isPending ? <Spinner className="size-4" /> : <X className="size-4" />}
          Cancel
        </Button>
      </ItemActions>
    </Item>
  );
}

function getNotificationTypeLabel(
  type: "labor_started" | "gone_to_hospital" | "born" | "photo_added",
): string {
  switch (type) {
    case "labor_started":
      return "Labor started";
    case "gone_to_hospital":
      return "Gone to hospital";
    case "born":
      return "Baby born";
    case "photo_added":
      return "Photo added";
  }
}
