import type { TranslationFunction } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { ensureWebPushSubscription, readWebPushSubscription } from "@/lib/web-push-subscription";
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
import { isFunction } from "@workspace/runtime/guards";
import type { InitiatedQuery } from "@workspace/query-prefetch";
import { getQueryInitiator, preloadedQueryOptions } from "@workspace/query-prefetch";
import type { ReactElement } from "react";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field";
import { Spinner } from "@workspace/ui/components/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { toast } from "sonner";

type BrowserPushCapability =
  | { kind: "unsupported" }
  | { kind: "needsIosInstall" }
  | { kind: "serviceWorkerTimeout" }
  | { kind: "unsubscribed" }
  | {
      kind: "subscribed";
      subscription: PushSubscription;
      family: boolean;
      messages: boolean;
    };

const browserPushCapabilityQueryKey = ["browserPushCapability"] as const;

const SERVICE_WORKER_READY_TIMEOUT_MS = 5000;
const SERVICE_WORKER_READY_TIMEOUT_MESSAGE = "Service worker ready timeout";

export function browserPushQueryOptions(queryClient: QueryClient, babyRef: string) {
  return queryOptions({
    queryKey: [...browserPushCapabilityQueryKey, babyRef],
    queryFn:
      globalThis.window !== undefined
        ? () => resolveBrowserPushCapability(queryClient, babyRef)
        : skipToken,
  });
}

function browserPushCapabilityFactory(queryClient: QueryClient) {
  return (babyRef: string) => browserPushQueryOptions(queryClient, babyRef);
}

export type BrowserPushCapabilityFactory = ReturnType<typeof browserPushCapabilityFactory>;

type RuntimeInitiatedBrowserPushCapability = Partial<{
  readonly input: unknown;
}>;

function initiatedBrowserPushCapability(
  babyRef: string,
): InitiatedQuery<BrowserPushCapabilityFactory>;
function initiatedBrowserPushCapability(babyRef: string): RuntimeInitiatedBrowserPushCapability {
  return { input: babyRef };
}

export function prefetchBrowserPushCapability(
  queryClient: QueryClient,
  babyRef: string,
): InitiatedQuery<BrowserPushCapabilityFactory> {
  if (globalThis.window === undefined) {
    return initiatedBrowserPushCapability(babyRef);
  }
  const factory = browserPushCapabilityFactory(queryClient);
  return getQueryInitiator(queryClient).ensureQueryData(factory, babyRef);
}

type NotificationSubscribeProps = {
  babyId: Id<"baby">;
  vapidPublicKey: PreloadedConvexQuery<typeof api.pushSubscriptions.getPublicKey>;
  browserPush: InitiatedQuery<BrowserPushCapabilityFactory>;
  audience: "visitor" | "manager";
};

type NotificationSelection = {
  family: boolean;
  messages: boolean;
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
  const subscribeAsOwnerMutationFn = useConvexMutation(api.pushSubscriptions.subscribeAsOwner);
  const unsubscribeAsOwnerMutationFn = useConvexMutation(api.pushSubscriptions.unsubscribeAsOwner);

  const syncDeviceNotifications = async (selection: NotificationSelection) => {
    if (
      !capability ||
      capability.kind === "unsupported" ||
      capability.kind === "needsIosInstall" ||
      !vapidPublicKey
    ) {
      throw new Error(t("Push notifications are not supported in this browser."));
    }

    const familyOn = capability.kind === "subscribed" && capability.family;
    const messagesOn = capability.kind === "subscribed" && capability.messages;
    if (!selection.family && !selection.messages) {
      const existing = await readWebPushSubscription();
      if (!existing) {
        return;
      }
      const pushKeys = {
        babyId: props.babyId,
        endpoint: existing.endpoint,
        p256dh: existing.p256dh,
        auth: existing.auth,
      };
      if (familyOn) {
        await unsubscribeMutationFn(pushKeys);
      }
      if (messagesOn) {
        await unsubscribeAsOwnerMutationFn(pushKeys);
      }
      return;
    }

    const keys = await ensureWebPushSubscription(vapidPublicKey);
    const pushKeys = {
      babyId: props.babyId,
      endpoint: keys.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: navigator.userAgent,
    };
    if (selection.family) {
      await subscribeMutationFn(pushKeys);
    } else if (familyOn) {
      await unsubscribeMutationFn(pushKeys);
    }
    if (selection.messages) {
      await subscribeAsOwnerMutationFn(pushKeys);
    } else if (messagesOn) {
      await unsubscribeAsOwnerMutationFn(pushKeys);
    }
  };

  const subscribeMutation = useMutation({
    mutationFn: syncDeviceNotifications,
    onSuccess: () => {
      void capabilityQuery.refetch();
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      const keys = await readWebPushSubscription();
      if (!keys) {
        throw new Error(t("Failed to get subscription data"));
      }
      return await unsubscribeMutationFn({
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

  const isLoading = subscribeMutation.isPending || unsubscribeMutation.isPending;
  const familyOn = capability?.kind === "subscribed" && capability.family;
  const messagesOn = capability?.kind === "subscribed" && capability.messages;
  const isSubscribed = props.audience === "manager" ? familyOn || messagesOn : familyOn;

  if (!capability || !vapidPublicKey) {
    return <GetNotificationsPending />;
  }

  switch (capability.kind) {
    case "needsIosInstall":
      return (
        <IosPwaInstallPrompt
          audience={props.audience === "manager" ? "owner" : "visitor"}
          trigger={
            <Button variant="default" size="lg">
              <Bell className="w-5 h-5" />
              {t("Get Notifications")}
            </Button>
          }
        />
      );
    case "unsupported":
    case "serviceWorkerTimeout":
    case "unsubscribed":
    case "subscribed":
      if (props.audience === "manager") {
        return (
          <ManagerNotificationChooserView
            familyDefault={!familyOn && !messagesOn ? true : Boolean(familyOn)}
            messagesDefault={!familyOn && !messagesOn ? true : Boolean(messagesOn)}
            isSubscribed={Boolean(isSubscribed)}
            isPending={isLoading}
            onSubmit={(selection) => {
              toastSubscribe(() => subscribeMutation.mutateAsync(selection), t);
            }}
          />
        );
      }
      return (
        <NotificationSubscribeControls
          isSubscribed={Boolean(isSubscribed)}
          isLoading={isLoading}
          onClick={() => {
            if (isSubscribed) {
              toast.promise(unsubscribeMutation.mutateAsync(), {
                loading: t("Unsubscribing from notifications..."),
                success: t("Unsubscribed from notifications!"),
                error: (error) =>
                  error instanceof Error
                    ? error.message
                    : t("Failed to unsubscribe from notifications"),
              });
              return;
            }
            toastSubscribe(
              () => subscribeMutation.mutateAsync({ family: true, messages: false }),
              t,
            );
          }}
        />
      );
  }
}

function toastSubscribe(mutateAsync: () => Promise<void>, t: TranslationFunction) {
  toast.promise(mutateAsync(), {
    loading: t("Subscribing to notifications..."),
    success: t("Subscribed to notifications!"),
    error: (error) =>
      error instanceof Error ? error.message : t("Failed to subscribe to notifications"),
  });
}

function GetNotificationsPending() {
  const { t } = useI18n();
  return (
    <Button variant="default" size="lg" disabled>
      <Bell className="w-5 h-5" />
      {t("Get Notifications")}
    </Button>
  );
}

export function IosPwaInstallPrompt(props: {
  trigger: ReactElement;
  audience: "visitor" | "owner";
}) {
  const { t } = useI18n();

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger render={<DialogTrigger render={props.trigger} />} />
        <TooltipContent className="max-w-xs">
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
        <ol className="flex list-decimal list-inside flex-col gap-3 text-sm">
          <li className="flex items-start gap-2">
            <span className="font-medium min-w-5">1.</span>
            <span>
              {t("Tap the Share button in Safari")} <Export className="inline w-4 h-4 mx-1" />
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-medium min-w-5">2.</span>
            <span>{t('Scroll down and tap "Add to Home Screen"')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-medium min-w-5">3.</span>
            <span>{t("Open the app from your Home Screen")}</span>
          </li>
          {props.audience === "owner" ? (
            <>
              <li className="flex items-start gap-2">
                <span className="font-medium min-w-5">4.</span>
                <span>
                  {t(
                    "The Home Screen icon does not inherit your Safari login. Sign in inside the app, then tap Get Notifications.",
                  )}
                </span>
              </li>
            </>
          ) : (
            <li className="flex items-start gap-2">
              <span className="font-medium min-w-5">4.</span>
              <span>{t('Come back here and tap "Get Notifications"')}</span>
            </li>
          )}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

function formCheckboxChecked(form: HTMLFormElement, id: string) {
  const named = form.querySelector(`#${id}`);
  if (named instanceof HTMLInputElement) {
    return named.checked;
  }
  if (named instanceof HTMLElement) {
    return named.getAttribute("aria-checked") === "true";
  }
  return false;
}

function readChooserSelection(form: HTMLFormElement) {
  return {
    family: formCheckboxChecked(form, "notify-family"),
    messages: formCheckboxChecked(form, "notify-messages"),
  };
}

/**
 * Uncontrolled chooser for managers picking status and/or message alerts.
 *
 * @internal
 */
export function ManagerNotificationChooserView(props: {
  familyDefault: boolean;
  messagesDefault: boolean;
  isSubscribed: boolean;
  isPending: boolean;
  onSubmit: (selection: NotificationSelection) => void;
}) {
  const { t } = useI18n();

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  disabled={props.isPending}
                  variant={props.isSubscribed ? "secondary" : "default"}
                  size="lg"
                >
                  <GetNotificationsButtonLabel
                    isSubscribed={props.isSubscribed}
                    isLoading={props.isPending}
                  />
                </Button>
              }
            />
          }
        />
        <TooltipContent>
          <p>{t("Pick what this device should receive.")}</p>
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            props.onSubmit(readChooserSelection(event.currentTarget));
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("Choose notifications")}</DialogTitle>
            <DialogDescription>{t("Pick what this device should receive.")}</DialogDescription>
          </DialogHeader>
          <FieldSet className="mt-4">
            <FieldLegend className="sr-only">{t("Choose notifications")}</FieldLegend>
            <FieldGroup>
              <Field orientation="horizontal">
                <Checkbox
                  id="notify-family"
                  name="family"
                  value="on"
                  defaultChecked={props.familyDefault}
                />
                <FieldContent>
                  <FieldTitle>
                    <label htmlFor="notify-family">{t("Status updates")}</label>
                  </FieldTitle>
                  <FieldDescription>
                    {t("Get notified when the baby's status changes")}
                  </FieldDescription>
                </FieldContent>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="notify-messages"
                  name="messages"
                  value="on"
                  defaultChecked={props.messagesDefault}
                />
                <FieldContent>
                  <FieldTitle>
                    <label htmlFor="notify-messages">{t("Message notifications")}</label>
                  </FieldTitle>
                  <FieldDescription>
                    {t("Get notified when someone leaves a message")}
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
          </FieldSet>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  disabled={props.isPending}
                  onClick={(event) => {
                    const form = event.currentTarget.closest("form");
                    if (form instanceof HTMLFormElement) {
                      props.onSubmit(readChooserSelection(form));
                    }
                  }}
                />
              }
            >
              {t("Save")}
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GetNotificationsButtonLabel(props: { isSubscribed: boolean; isLoading: boolean }) {
  const { t } = useI18n();
  if (props.isSubscribed) {
    return (
      <>
        {props.isLoading ? <Spinner className="w-5 h-5" /> : <BellSlash className="w-5 h-5" />}
        {t("Unsubscribe")}
      </>
    );
  }
  return (
    <>
      {props.isLoading ? <Spinner className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
      {t("Get Notifications")}
    </>
  );
}

function NotificationSubscribeControls(props: {
  isSubscribed: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const tooltip = props.isSubscribed
    ? "Stop receiving push notifications for updates"
    : "Get notified when the baby's status changes";

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
            <GetNotificationsButtonLabel
              isSubscribed={props.isSubscribed}
              isLoading={props.isLoading}
            />
          </Button>
        }
      />
      <TooltipContent>
        <p>{t(tooltip)}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function hasLegacyMSStream(value: Window): value is Window & { MSStream: unknown } {
  return "MSStream" in value;
}

function hasStandaloneFlag(
  value: Navigator,
): value is Navigator & { standalone: boolean | undefined } {
  return "standalone" in value;
}

function getIOSStatus() {
  if (globalThis.window === undefined) {
    return { isIOS: false, isStandalone: false };
  }

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    (!hasLegacyMSStream(window) || !window.MSStream);
  if (!isIOS) {
    return { isIOS: false, isStandalone: false };
  }

  const isStandalone =
    (isFunction(window.matchMedia) && window.matchMedia("(display-mode: standalone)").matches) ||
    (hasStandaloneFlag(navigator) && navigator.standalone === true);

  return { isIOS: true, isStandalone };
}

export function needsIosPushInstall() {
  const iosStatus = getIOSStatus();
  return iosStatus.isIOS && !iosStatus.isStandalone;
}

function isPushSupported() {
  return (
    globalThis.window !== undefined &&
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

function fetchFamilyIsSubscribed(opts: {
  queryClient: QueryClient;
  babyRef: string;
  endpoint: string;
}) {
  return opts.queryClient.fetchQuery(
    convexQuery(api.pushSubscriptions.isSubscribed, {
      babyId: opts.babyRef,
      endpoint: opts.endpoint,
    }),
  );
}

function fetchOwnerIsSubscribed(opts: {
  queryClient: QueryClient;
  babyRef: string;
  endpoint: string;
}) {
  return opts.queryClient.fetchQuery(
    convexQuery(api.pushSubscriptions.isOwnerSubscribed, {
      babyId: opts.babyRef,
      endpoint: opts.endpoint,
    }),
  );
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
      const [family, messages] = await Promise.all([
        fetchFamilyIsSubscribed({
          queryClient,
          babyRef,
          endpoint: subscription.endpoint,
        }),
        fetchOwnerIsSubscribed({
          queryClient,
          babyRef,
          endpoint: subscription.endpoint,
        }),
      ]);
      return {
        kind: "subscribed",
        subscription,
        family: Boolean(family),
        messages: Boolean(messages),
      };
    }
    return { kind: "unsubscribed" };
  } catch (error) {
    if (error instanceof Error && error.message === SERVICE_WORKER_READY_TIMEOUT_MESSAGE) {
      return { kind: "serviceWorkerTimeout" };
    }
    return { kind: "unsubscribed" };
  }
}
