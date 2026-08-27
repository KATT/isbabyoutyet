import type { TranslationFunction } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { useConvexMutation } from "@convex-dev/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Bell, BellSlash, Export } from "@phosphor-icons/react";
import {
  queryOptions,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { preloadedConvexQueryOptions } from "@workspace/convex-prefetch";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { InitiatedQuery } from "@workspace/query-prefetch";
import { getQueryInitiator, preloadedQueryOptions } from "@workspace/query-prefetch";
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
import { toast } from "sonner";
import * as stylex from "@stylexjs/stylex";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { Inline } from "@workspace/ui-patterns/components/inline";

type BrowserPushCapability =
  | { kind: "unsupported" }
  | { kind: "needsIosInstall" }
  | { kind: "serviceWorkerTimeout" }
  | { kind: "unsubscribed" }
  | { kind: "subscribed"; subscription: PushSubscription; isSubscribed: boolean };

const browserPushCapabilityQueryKey = ["browserPushCapability"] as const;

const SERVICE_WORKER_READY_TIMEOUT_MS = 5000;
const SERVICE_WORKER_READY_TIMEOUT_MESSAGE = "Service worker ready timeout";

export function browserPushQueryOptions(queryClient: QueryClient, babyRef: string) {
  return queryOptions({
    queryKey: [...browserPushCapabilityQueryKey, babyRef],
    queryFn:
      typeof window !== "undefined"
        ? () => resolveBrowserPushCapability(queryClient, babyRef)
        : skipToken,
  });
}

function browserPushCapabilityFactory(queryClient: QueryClient) {
  return (babyRef: string) => browserPushQueryOptions(queryClient, babyRef);
}

export type BrowserPushCapabilityFactory = ReturnType<typeof browserPushCapabilityFactory>;

export function prefetchBrowserPushCapability(
  queryClient: QueryClient,
  babyRef: string,
): InitiatedQuery<BrowserPushCapabilityFactory> {
  if (typeof window === "undefined") {
    return { input: babyRef } as InitiatedQuery<BrowserPushCapabilityFactory>;
  }
  const factory = browserPushCapabilityFactory(queryClient);
  return getQueryInitiator(queryClient).ensureQueryData(factory, babyRef);
}

type NotificationSubscribeProps = {
  babyId: Id<"baby">;
  vapidPublicKey: PreloadedConvexQuery<typeof api.pushSubscriptions.getPublicKey>;
  browserPush: InitiatedQuery<BrowserPushCapabilityFactory>;
};

export function NotificationSubscribe(props: NotificationSubscribeProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const capabilityQuery = useQuery(
    preloadedQueryOptions(browserPushCapabilityFactory(queryClient), props.browserPush),
  );
  const capability = capabilityQuery.data;
  const vapidPublicKeyQuery = useQuery(
    preloadedConvexQueryOptions(api.pushSubscriptions.getPublicKey, props.vapidPublicKey),
  );
  const vapidPublicKey = vapidPublicKeyQuery.data;

  const subscribeMutationFn = useConvexMutation(api.pushSubscriptions.subscribe);
  const unsubscribeMutationFn = useConvexMutation(api.pushSubscriptions.unsubscribe);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (
        !capability ||
        capability.kind === "unsupported" ||
        capability.kind === "needsIosInstall" ||
        !vapidPublicKey
      ) {
        throw new Error(t("Push notifications are not supported in this browser."));
      }

      if (Notification.permission === "default") {
        const permissionResult = await Notification.requestPermission();

        if (permissionResult !== "granted") {
          throw new Error(t("Notification permission denied"));
        }
      } else if (Notification.permission !== "granted") {
        throw new Error(t("Notification permission is required"));
      }

      const registration = await navigator.serviceWorker.ready;

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      const subscriptionData = pushSubscription.toJSON();
      if (
        subscriptionData.endpoint &&
        subscriptionData.keys?.p256dh &&
        subscriptionData.keys?.auth
      ) {
        return await subscribeMutationFn({
          babyId: props.babyId,
          endpoint: subscriptionData.endpoint,
          p256dh: subscriptionData.keys.p256dh,
          auth: subscriptionData.keys.auth,
          userAgent: navigator.userAgent,
        });
      }

      throw new Error(t("Failed to get subscription data"));
    },
    onSuccess: () => {
      void capabilityQuery.refetch();
    },
  });

  const unsubscribeMutation = useMutation<unknown, Error, PushSubscription>({
    mutationFn: async (subscription) => {
      const subscriptionData = subscription.toJSON();
      if (
        !subscriptionData.endpoint ||
        !subscriptionData.keys?.p256dh ||
        !subscriptionData.keys.auth
      ) {
        throw new Error(t("Failed to get subscription data"));
      }
      return await unsubscribeMutationFn({
        babyId: props.babyId,
        endpoint: subscriptionData.endpoint,
        p256dh: subscriptionData.keys.p256dh,
        auth: subscriptionData.keys.auth,
      });
    },
    onSuccess: () => {
      void capabilityQuery.refetch();
    },
  });

  const isLoading = subscribeMutation.isPending || unsubscribeMutation.isPending;

  if (!capability || !vapidPublicKey) {
    return <GetNotificationsPending />;
  }

  switch (capability.kind) {
    case "needsIosInstall":
      return <IosPwaInstallPrompt />;
    case "unsupported":
    case "serviceWorkerTimeout":
    case "unsubscribed":
      return (
        <NotificationSubscribeControls
          isSubscribed={false}
          isLoading={isLoading}
          onClick={() => {
            toastSubscribe(subscribeMutation.mutateAsync, t);
          }}
        />
      );
    case "subscribed":
      return (
        <NotificationSubscribeControls
          isSubscribed={capability.isSubscribed}
          isLoading={isLoading}
          onClick={() => {
            if (capability.isSubscribed) {
              toast.promise(unsubscribeMutation.mutateAsync(capability.subscription), {
                loading: t("Unsubscribing from notifications..."),
                success: t("Unsubscribed from notifications!"),
                error: (error) =>
                  error instanceof Error
                    ? error.message
                    : t("Failed to unsubscribe from notifications"),
              });
            } else {
              toastSubscribe(subscribeMutation.mutateAsync, t);
            }
          }}
        />
      );
  }
}

function toastSubscribe(mutateAsync: () => Promise<unknown>, t: TranslationFunction) {
  toast.promise(mutateAsync(), {
    loading: t("Subscribing to notifications..."),
    success: t("Subscribed to notifications!"),
    error: (error) =>
      error instanceof Error ? error.message : t("Failed to subscribe to notifications"),
  });
}

const styles = stylex.create({
  stepNum: {
    fontWeight: 500,
    minWidth: "1.25rem",
  },
});

function GetNotificationsPending() {
  const { t } = useI18n();
  return (
    <Button variant="default" size="lg" disabled>
      <Bell size={20} />
      {t("Get Notifications")}
    </Button>
  );
}

function IosPwaInstallPrompt() {
  const { t } = useI18n();

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button variant="default" size="lg">
                  <Bell size={20} />
                  {t("Get Notifications")}
                </Button>
              }
            />
          }
        />
        <TooltipContent>
          <p>
            {t(
              "To receive notifications on iOS, add this page to your Home Screen first. Tap for instructions.",
            )}
          </p>
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Get Notifications on iOS")}</DialogTitle>
          <DialogDescription>
            {t("Install this app on your Home Screen before enabling push notifications on iOS.")}
          </DialogDescription>
        </DialogHeader>
        <Stack gap="s3">
          <Inline gap="s2" align="start" wrap={false}>
            <span {...stylex.props(styles.stepNum)}>1.</span>
            <Text as="span" size="sm">
              {t("Tap the Share button in Safari")} <Export size={16} />
            </Text>
          </Inline>
          <Inline gap="s2" align="start" wrap={false}>
            <span {...stylex.props(styles.stepNum)}>2.</span>
            <Text as="span" size="sm">
              {t('Scroll down and tap "Add to Home Screen"')}
            </Text>
          </Inline>
          <Inline gap="s2" align="start" wrap={false}>
            <span {...stylex.props(styles.stepNum)}>3.</span>
            <Text as="span" size="sm">
              {t("Open the app from your Home Screen")}
            </Text>
          </Inline>
          <Inline gap="s2" align="start" wrap={false}>
            <span {...stylex.props(styles.stepNum)}>4.</span>
            <Text as="span" size="sm">
              {t('Come back here and tap "Get Notifications"')}
            </Text>
          </Inline>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function NotificationSubscribeControls(props: {
  isSubscribed: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            onClick={props.onClick}
            disabled={props.isLoading}
            variant={props.isSubscribed ? "secondary" : "default"}
            size="lg"
          >
            {props.isSubscribed ? (
              <>
                {props.isLoading ? <Spinner /> : <BellSlash size={20} />}
                {t("Unsubscribe")}
              </>
            ) : (
              <>
                {props.isLoading ? <Spinner /> : <Bell size={20} />}
                {t("Get Notifications")}
              </>
            )}
          </Button>
        }
      />
      <TooltipContent>
        <p>
          {props.isSubscribed
            ? t("Stop receiving push notifications for updates")
            : t("Get notified when the baby's status changes")}
        </p>
      </TooltipContent>
    </Tooltip>
  );
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

async function resolveBrowserPushCapability(
  queryClient: QueryClient,
  babyRef: string,
): Promise<BrowserPushCapability> {
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
      const isSubscribed = await queryClient.fetchQuery(
        convexQuery(api.pushSubscriptions.isSubscribed, {
          babyId: babyRef,
          endpoint: subscription.endpoint,
        }) as unknown as Parameters<QueryClient["fetchQuery"]>[0],
      );
      return { kind: "subscribed", subscription, isSubscribed: Boolean(isSubscribed) };
    }
    return { kind: "unsubscribed" };
  } catch (error) {
    if (error instanceof Error && error.message === SERVICE_WORKER_READY_TIMEOUT_MESSAGE) {
      return { kind: "serviceWorkerTimeout" };
    }
    return { kind: "unsubscribed" };
  }
}

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
