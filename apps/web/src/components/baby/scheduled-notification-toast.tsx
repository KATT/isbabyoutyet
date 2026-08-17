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
import { useConvexMutation } from "@convex-dev/react-query";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { api } from "@workspace/convex/convex/_generated/api";
import { Check, X } from "@phosphor-icons/react";
import type { NotifiableStatus } from "@workspace/convex/src/types";
import { FORBIDDEN } from "@workspace/convex/src/types";
import type { InitiatedConvexQuery, PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { useI18n } from "@/lib/i18n";
import { NOTIFICATION_LABEL_KEYS } from "./translation-keys";

type ScheduledNotificationToastProps = {
  notifications:
    | PreloadedConvexQuery<typeof api.baby.getScheduledNotifications>
    | InitiatedConvexQuery<typeof api.baby.getScheduledNotifications>;
  subscriptionCount:
    | PreloadedConvexQuery<typeof api.pushSubscriptions.getSubscriptionCount>
    | InitiatedConvexQuery<typeof api.pushSubscriptions.getSubscriptionCount>;
};

function subscribeToCurrentSecond(notify: () => void) {
  const interval = window.setInterval(notify, 1000);
  return () => window.clearInterval(interval);
}

function getCurrentSecond() {
  return Math.floor(Date.now() / 1000);
}

function useCurrentSecond() {
  return useSyncExternalStore(subscribeToCurrentSecond, getCurrentSecond, () => null);
}

export function ScheduledNotificationToast(props: ScheduledNotificationToastProps) {
  const { t } = useI18n();
  const notificationsQuery = usePreloadedConvexQuery(
    api.baby.getScheduledNotifications,
    props.notifications,
  );
  // FORBIDDEN only happens for non-managers, who never render this component —
  // treat it like "nothing scheduled" so the types stay honest.
  const notificationsData = notificationsQuery.data;
  const notifications = notificationsData === FORBIDDEN ? [] : notificationsData;
  const subscriptionCountQuery = usePreloadedConvexQuery(
    api.pushSubscriptions.getSubscriptionCount,
    props.subscriptionCount,
  );
  const subscriptionCount =
    subscriptionCountQuery.data === FORBIDDEN ? 0 : subscriptionCountQuery.data;
  const currentSecond = useCurrentSecond();
  if (currentSecond === null || subscriptionCount === 0) return null;

  const currentTime = currentSecond * 1000;
  const visibleNotifications = notifications.filter(
    (notification) =>
      notification.status === "pending" ||
      (notification.status === "sent" &&
        currentTime >= notification.scheduledFor &&
        currentTime - notification.scheduledFor < 4000),
  );
  if (visibleNotifications.length === 0) return null;

  return (
    <aside
      className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2"
      aria-live="polite"
    >
      {visibleNotifications.map((notification) =>
        notification.status === "pending" ? (
          <NotificationToastContent
            key={notification._id}
            notificationId={notification._id}
            notificationType={notification.notificationType}
            scheduledFor={notification.scheduledFor}
            subscriptionCount={subscriptionCount}
            currentTime={currentTime}
          />
        ) : (
          <Item
            key={notification._id}
            variant="outline"
            className="min-w-[300px] border-green-500/50 bg-background shadow-lg"
          >
            <ItemMedia className="size-10 rounded-full bg-green-500/10">
              <Check className="size-5 text-green-500" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{t("Notification sent!")}</ItemTitle>
              <ItemDescription>
                {t(NOTIFICATION_LABEL_KEYS[notification.notificationType])} ·{" "}
                {t(subscriptionCount === 1 ? "{{count}} person" : "{{count}} people", {
                  count: subscriptionCount,
                })}
              </ItemDescription>
            </ItemContent>
          </Item>
        ),
      )}
    </aside>
  );
}

type NotificationToastContentProps = {
  notificationId: Id<"scheduledNotifications">;
  notificationType: NotifiableStatus;
  scheduledFor: number;
  subscriptionCount: number;
  currentTime: number;
};

function NotificationToastContent(props: NotificationToastContentProps) {
  const { t } = useI18n();
  const seconds = Math.max(0, Math.ceil((props.scheduledFor - props.currentTime) / 1000));

  const cancelMutation = useTanstackMutation({
    mutationFn: useConvexMutation(api.baby.cancelScheduledNotification),
    onSuccess: () => {
      toast.dismiss(props.notificationId);
      toast.success(t("Notification cancelled"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("Failed to cancel notification"));
    },
  });

  return (
    <Item variant="outline" className="min-w-[300px] shadow-lg bg-background">
      <ItemMedia className="size-10 rounded-full bg-primary/10 tabular-nums text-lg font-semibold text-primary">
        {seconds}
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{t("Sending notification...")}</ItemTitle>
        <ItemDescription>
          {t(NOTIFICATION_LABEL_KEYS[props.notificationType])} ·{" "}
          {t(props.subscriptionCount === 1 ? "{{count}} person" : "{{count}} people", {
            count: props.subscriptionCount,
          })}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          variant="outline"
          size="sm"
          disabled={cancelMutation.isPending}
          onClick={() => cancelMutation.mutate({ notificationId: props.notificationId })}
        >
          {cancelMutation.isPending ? <Spinner className="size-4" /> : <X className="size-4" />}
          {t("Cancel")}
        </Button>
      </ItemActions>
    </Item>
  );
}
