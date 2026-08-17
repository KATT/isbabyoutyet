import { useI18n } from "@/lib/i18n";
import { Info } from "@phosphor-icons/react";
import { isHomepageDemoPublicId } from "@workspace/convex/src/seedCredentials";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item";

type HomepageDemoToastProps = {
  publicId: string;
};

/**
 * Persistent notice on the public homepage demo baby so visitors know they
 * can try posting without affecting a real family.
 */
export function HomepageDemoToast(props: HomepageDemoToastProps) {
  const { t } = useI18n();
  if (!isHomepageDemoPublicId(props.publicId)) return null;

  return (
    <aside className="fixed bottom-4 left-4 z-40 max-w-[calc(100vw-2rem)]" aria-live="polite">
      <Item
        variant="outline"
        className="min-w-[300px] max-w-sm border-primary/40 bg-background shadow-lg"
      >
        <ItemMedia className="size-10 rounded-full bg-primary/10">
          <Info className="size-5 text-primary" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{t("This is a demo baby")}</ItemTitle>
          <ItemDescription>
            {t("Feel free to post test messages — they get cleared on each deploy.")}
          </ItemDescription>
        </ItemContent>
      </Item>
    </aside>
  );
}
