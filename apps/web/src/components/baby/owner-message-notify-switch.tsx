import { useI18n } from "@/lib/i18n";
import { ensureWebPushSubscription, readWebPushSubscription } from "@/lib/web-push-subscription";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { Bell } from "@phosphor-icons/react";
import { preloadedConvexQueryOptions } from "@workspace/convex-prefetch";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { InitiatedQuery } from "@workspace/query-prefetch";
import { preloadedQueryOptions } from "@workspace/query-prefetch";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item";
import { FormControl, FormField, FormItem, useFormField } from "@workspace/ui/components/form";
import { Switch } from "@workspace/ui/components/switch";
import { toast } from "sonner";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  browserPushQueryOptions,
  type BrowserPushCapabilityFactory,
} from "./notification-subscribe";

type DisabledReason = "unsupported" | "needsIosInstall";

function ownerMessageNotifyCopy(opts: { checked: boolean; disabledReason: DisabledReason | null }) {
  if (opts.disabledReason === "needsIosInstall") {
    return {
      title: "Message notifications",
      description:
        "Install this app on your Home Screen before enabling push notifications on iOS.",
    } as const;
  }
  if (opts.disabledReason === "unsupported") {
    return {
      title: "Message notifications",
      description: "Push notifications are not supported in this browser.",
    } as const;
  }
  return {
    title: "Message notifications",
    description: opts.checked
      ? "You'll get a push when someone leaves a message on this page."
      : "Get notified when someone leaves a message",
  } as const;
}

type SwitchViewProps = {
  checked: boolean;
  disabled: boolean;
  disabledReason: DisabledReason | null;
  onCheckedChange: ((checked: boolean) => void) | null;
};

/**
 * Presentational message-notification switch for tests and both layouts.
 *
 * @internal
 */
export function OwnerMessageNotifySwitchView(
  props: SwitchViewProps & { layout: "form" | "settings" },
) {
  if (props.layout === "settings") {
    return <SettingsMessageNotifyRow {...props} />;
  }
  return <FormMessageNotifyRow {...props} />;
}

function SettingsMessageNotifyRow(props: SwitchViewProps) {
  const { t } = useI18n();
  const copy = ownerMessageNotifyCopy(props);
  const titleId = "owner-message-notify-title";

  return (
    <Item>
      <ItemMedia variant="icon">
        <Bell />
      </ItemMedia>
      <ItemContent>
        <ItemTitle id={titleId}>{t(copy.title)}</ItemTitle>
        <ItemDescription>{t(copy.description)}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Switch
          checked={props.checked}
          disabled={props.disabled || props.onCheckedChange === null}
          onCheckedChange={(checked) => {
            props.onCheckedChange?.(checked);
          }}
          aria-labelledby={titleId}
        />
      </ItemActions>
    </Item>
  );
}

function FormMessageNotifyRow(props: SwitchViewProps) {
  const { t } = useI18n();
  const { formItemId, formDescriptionId } = useFormField();
  const copy = ownerMessageNotifyCopy(props);
  const titleId = `${formItemId}-title`;

  return (
    <label htmlFor={formItemId} className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span id={titleId} className="text-sm leading-none font-bold">
          {t(copy.title)}
        </span>
        <span id={formDescriptionId} className="text-muted-foreground text-sm">
          {t(copy.description)}
        </span>
      </div>
      <FormControl aria-labelledby={titleId}>
        <Switch
          id={formItemId}
          checked={props.checked}
          disabled={props.disabled || props.onCheckedChange === null}
          onCheckedChange={(checked) => {
            props.onCheckedChange?.(checked);
          }}
        />
      </FormControl>
    </label>
  );
}

export function OwnerMessageNotifyFormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(props: { control: Control<TFieldValues, unknown, unknown>; name: TName }) {
  return (
    <FormField
      control={props.control}
      name={props.name}
      render={(renderProps) => (
        <FormItem className="border-0 p-0">
          <OwnerMessageNotifySwitchView
            checked={Boolean(renderProps.field.value)}
            disabled={false}
            disabledReason={null}
            onCheckedChange={renderProps.field.onChange}
            layout="form"
          />
        </FormItem>
      )}
    />
  );
}

function browserPushCapabilityFactory(queryClient: QueryClient) {
  return (babyRef: string) => browserPushQueryOptions(queryClient, babyRef);
}

type OwnerMessageNotifyLiveSwitchProps = {
  babyId: Id<"baby">;
  vapidPublicKey: PreloadedConvexQuery<typeof api.pushSubscriptions.getPublicKey>;
  browserPush: InitiatedQuery<BrowserPushCapabilityFactory>;
};

export function OwnerMessageNotifyLiveSwitch(props: OwnerMessageNotifyLiveSwitchProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const capabilityQuery = useQuery(
    preloadedQueryOptions(browserPushCapabilityFactory(queryClient), props.browserPush),
  );
  const vapidPublicKeyQuery = useQuery(
    preloadedConvexQueryOptions(api.pushSubscriptions.getPublicKey, props.vapidPublicKey),
  );
  const subscribeAsOwnerMutationFn = useConvexMutation(api.pushSubscriptions.subscribeAsOwner);
  const unsubscribeAsOwnerMutationFn = useConvexMutation(api.pushSubscriptions.unsubscribeAsOwner);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const vapidPublicKey = vapidPublicKeyQuery.data;
      if (!vapidPublicKey) {
        throw new Error(t("Push notifications are not supported in this browser."));
      }
      const keys = await ensureWebPushSubscription(vapidPublicKey);
      await subscribeAsOwnerMutationFn({
        babyId: props.babyId,
        endpoint: keys.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: navigator.userAgent,
      });
    },
    onSuccess: () => {
      void capabilityQuery.refetch();
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      const keys = await readWebPushSubscription();
      if (!keys) {
        return;
      }
      await unsubscribeAsOwnerMutationFn({
        babyId: props.babyId,
        endpoint: keys.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });
    },
    onSuccess: () => {
      void capabilityQuery.refetch();
    },
  });

  const capability = capabilityQuery.data;
  const checked = capability?.kind === "subscribed" && capability.messages;
  const disabledReason =
    capability?.kind === "needsIosInstall"
      ? "needsIosInstall"
      : capability?.kind === "unsupported"
        ? "unsupported"
        : null;
  const isPending = subscribeMutation.isPending || unsubscribeMutation.isPending;

  return (
    <OwnerMessageNotifySwitchView
      checked={Boolean(checked)}
      disabled={
        isPending ||
        !capability ||
        !vapidPublicKeyQuery.data ||
        disabledReason !== null ||
        capability.kind === "serviceWorkerTimeout"
      }
      disabledReason={disabledReason}
      onCheckedChange={(nextChecked) => {
        if (nextChecked) {
          toast.promise(subscribeMutation.mutateAsync(), {
            loading: t("Subscribing to notifications..."),
            success: t("Subscribed to notifications!"),
            error: (error) =>
              error instanceof Error ? error.message : t("Failed to subscribe to notifications"),
          });
          return;
        }
        toast.promise(unsubscribeMutation.mutateAsync(), {
          loading: t("Unsubscribing from notifications..."),
          success: t("Unsubscribed from notifications!"),
          error: (error) =>
            error instanceof Error ? error.message : t("Failed to unsubscribe from notifications"),
        });
      }}
      layout="settings"
    />
  );
}
