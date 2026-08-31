import { useI18n } from "@/lib/i18n";
import { Info } from "@phosphor-icons/react";
import { isHomepageDemoPublicId } from "@workspace/convex/src/seedCredentials";
import { Button } from "@workspace/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item";
import { createDismissedIdsStore, useIsDismissed } from "@/lib/use-dismissed-ids";

type HomepageDemoToastProps = {
  publicId: string;
};

/** @internal Exported for tests. */
export const homepageDemoDismissals = createDismissedIdsStore();

/**
 * Persistent notice on the public homepage demo baby so visitors know they
 * can try posting without affecting a real family.
 */
export function HomepageDemoToast(props: HomepageDemoToastProps) {
  const { t } = useI18n();
  const dismissed = useIsDismissed(homepageDemoDismissals, props.publicId);
  if (!isHomepageDemoPublicId(props.publicId) || dismissed) return null;

  return (
    <aside className="pointer-events-auto w-full" aria-live="polite">
      <Item
        variant="outline"
        className="w-full min-w-0 flex-nowrap border-primary/40 bg-background shadow-lg"
      >
        <ItemMedia className="size-10 rounded-full bg-primary/10">
          <Info className="size-5 text-primary" />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle>{t("This is a demo baby")}</ItemTitle>
          <ItemDescription>
            {t("Feel free to post test messages — we reset this demo daily.")}
          </ItemDescription>
        </ItemContent>
        <ItemActions className="shrink-0 self-start">
          <Button
            type="button"
            variant="outline"
            size="default"
            className="relative after:absolute after:-inset-3 after:content-['']"
            onClick={() => homepageDemoDismissals.dismiss(props.publicId)}
          >
            {t("Got it")}
          </Button>
        </ItemActions>
      </Item>
    </aside>
  );
}
