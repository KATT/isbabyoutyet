import { useEffect } from "react";
import { toast } from "sonner";
import { isHomepageDemoPublicId } from "@workspace/convex/src/seedCredentials";
import { useI18n } from "@/lib/i18n";
import { createDismissedIdsStore, useIsDismissed } from "@/lib/use-dismissed-ids";

const demoToastDismissals = createDismissedIdsStore();

function demoToastId(publicId: string) {
  return `homepage-demo-${publicId}`;
}

/** @internal */
export function resetDemoToastDismissals() {
  demoToastDismissals.clear();
}

/**
 * Persistent Sonner info toast on homepage demo babies. Owns the dismiss
 * store and show/dismiss against Sonner's toast manager so Got it plays the
 * built-in exit animation.
 */
export function useDemoToast(opts: { publicId: string; enabled: boolean }) {
  const { t } = useI18n();
  const dismissed = useIsDismissed(demoToastDismissals, opts.publicId);
  const shouldShow = opts.enabled && isHomepageDemoPublicId(opts.publicId) && !dismissed;
  const toastId = demoToastId(opts.publicId);
  const title = t("This is a demo baby");
  const description = t("Feel free to post test messages — we reset this demo daily.");
  const actionLabel = t("Got it");

  useEffect(() => {
    if (!shouldShow) return;
    toast.info(title, {
      id: toastId,
      description,
      duration: Infinity,
      action: {
        label: actionLabel,
        onClick: () => {
          demoToastDismissals.dismiss(opts.publicId);
        },
      },
      onDismiss: () => {
        demoToastDismissals.dismiss(opts.publicId);
      },
    });
    return () => {
      toast.dismiss(toastId);
    };
  }, [shouldShow, toastId, title, description, actionLabel, opts.publicId]);
}
