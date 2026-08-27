import { Button } from "@workspace/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item";
import { Spinner } from "@workspace/ui/components/spinner";
import { useMutation as useTanstackMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { toast } from "sonner";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { api } from "@workspace/convex/convex/_generated/api";
import { Check, X } from "@phosphor-icons/react";
import type { NotifiableStatus } from "@workspace/convex/src/types";
import { FORBIDDEN } from "@workspace/convex/src/types";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { useI18n } from "@/lib/i18n";
import { useTimedTransition } from "@/lib/use-delayed-action";
import { useCurrentSecond } from "@/lib/use-current-second";
import { NOTIFICATION_LABEL_KEYS } from "./translation-keys";
import * as stylex from "@stylexjs/stylex";
import { colors, radius, spacing } from "@workspace/ui/lib/tokens.stylex";

type ScheduledNotificationsResult = Exclude<
  FunctionReturnType<typeof api.baby.getScheduledNotifications>,
  typeof FORBIDDEN
>;

const EMPTY_NOTIFICATIONS: ScheduledNotificationsResult = [];

type ScheduledNotificationToastProps = {
  notifications: PreloadedConvexQuery<typeof api.baby.getScheduledNotifications>;
  subscriptionCount: PreloadedConvexQuery<typeof api.pushSubscriptions.getSubscriptionCount>;
};

const styles = stylex.create({
  aside: {
    bottom: spacing.s4,
    display: "flex",
    flexDirection: "column",
    gap: spacing.s2,
    maxWidth: "calc(100vw - 2rem)",
    position: "fixed",
    right: spacing.s4,
    zIndex: 50,
  },
  toastShell: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    minWidth: "300px",
  },
  toastShellSent: {
    borderColor: "color-mix(in oklab, #22c55e 50%, transparent)",
  },
  media: {
    alignItems: "center",
    borderRadius: "9999px",
    display: "flex",
    flexShrink: 0,
    fontSize: "1.125rem",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    height: "2.5rem",
    justifyContent: "center",
    width: "2.5rem",
  },
  mediaPending: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 10%, transparent)`,
    color: colors.primary,
  },
  mediaSent: {
    backgroundColor: "color-mix(in oklab, #22c55e 10%, transparent)",
  },
  checkIcon: {
    color: "#22c55e",
    height: "1.25rem",
    width: "1.25rem",
  },
});

export function ScheduledNotificationToast(props: ScheduledNotificationToastProps) {
  const notificationsQuery = usePreloadedConvexQuery(
    api.baby.getScheduledNotifications,
    props.notifications,
  );
  const notificationsData = notificationsQuery.data;
  const notifications = notificationsData === FORBIDDEN ? EMPTY_NOTIFICATIONS : notificationsData;
  const subscriptionCountQuery = usePreloadedConvexQuery(
    api.pushSubscriptions.getSubscriptionCount,
    props.subscriptionCount,
  );
  const subscriptionCount =
    subscriptionCountQuery.data === FORBIDDEN ? 0 : subscriptionCountQuery.data;
  const tickEnabled = subscriptionCount > 0 && notifications.length > 0;
  const currentSecond = useCurrentSecond(tickEnabled);
  if (!tickEnabled || currentSecond === null) return null;

  const currentTime = currentSecond * 1000;

  return (
    <aside {...stylex.props(styles.aside)} aria-live="polite">
      {notifications.map((notification) => (
        <ScheduledNotificationItem
          key={notification._id}
          notification={notification}
          subscriptionCount={subscriptionCount}
          currentTime={currentTime}
        />
      ))}
    </aside>
  );
}

type ScheduledNotification = Exclude<
  FunctionReturnType<typeof api.baby.getScheduledNotifications>,
  typeof FORBIDDEN
>[number];

function ScheduledNotificationItem(props: {
  notification: ScheduledNotification;
  subscriptionCount: number;
  currentTime: number;
}) {
  const { t } = useI18n();
  const sentRecently = useTimedTransition({
    durationMs: 4000,
    from: "pending",
    to: "sent",
    value: props.notification.status,
  });

  if (props.notification.status === "pending") {
    return (
      <NotificationToastContent
        notificationId={props.notification._id}
        notificationType={props.notification.notificationType}
        scheduledFor={props.notification.scheduledFor}
        subscriptionCount={props.subscriptionCount}
        currentTime={props.currentTime}
      />
    );
  }
  if (!sentRecently) return null;

  return (
    <div {...stylex.props(styles.toastShell, styles.toastShellSent)}>
      <Item variant="outline">
        <div {...stylex.props(styles.media, styles.mediaSent)}>
          <Check {...stylex.props(styles.checkIcon)} />
        </div>
        <ItemContent>
          <ItemTitle>{t("Notification sent!")}</ItemTitle>
          <ItemDescription>
            {t(NOTIFICATION_LABEL_KEYS[props.notification.notificationType])} ·{" "}
            {t(props.subscriptionCount === 1 ? "{{count}} person" : "{{count}} people", {
              count: props.subscriptionCount,
            })}
          </ItemDescription>
        </ItemContent>
      </Item>
    </div>
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
      toast.success(t("Notification cancelled"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("Failed to cancel notification"));
    },
  });

  if (cancelMutation.isSuccess) return null;

  return (
    <div {...stylex.props(styles.toastShell)}>
      <Item variant="outline">
        <div {...stylex.props(styles.media, styles.mediaPending)}>{seconds}</div>
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
            {cancelMutation.isPending ? <Spinner /> : <X size={16} />}
            {t("Cancel")}
          </Button>
        </ItemActions>
      </Item>
    </div>
  );
}
