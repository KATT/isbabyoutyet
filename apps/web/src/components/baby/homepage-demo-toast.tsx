import { useI18n } from "@/lib/i18n";
import { Info, X } from "@phosphor-icons/react";
import { isHomepageDemoPublicId } from "@workspace/convex/src/seedCredentials";
import { Button } from "@workspace/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item";
import { createDismissedIdsStore } from "@/lib/use-dismissed-ids";
import * as stylex from "@stylexjs/stylex";
import { colors, radius, spacing } from "@workspace/ui/lib/tokens.stylex";

type HomepageDemoToastProps = {
  publicId: string;
};

const homepageDemoDismissals = createDismissedIdsStore();

const styles = stylex.create({
  aside: {
    bottom: spacing.s4,
    left: spacing.s4,
    maxWidth: "calc(100vw - 2rem)",
    position: "fixed",
    zIndex: 40,
  },
  shell: {
    backgroundColor: colors.background,
    borderColor: `color-mix(in oklab, ${colors.primary} 40%, transparent)`,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    maxWidth: "24rem",
    minWidth: "300px",
  },
  media: {
    alignItems: "center",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 10%, transparent)`,
    borderRadius: "9999px",
    display: "flex",
    height: "2.5rem",
    justifyContent: "center",
    width: "2.5rem",
  },
  icon: {
    color: colors.primary,
    height: "1.25rem",
    width: "1.25rem",
  },
});

/**
 * Persistent notice on the public homepage demo baby so visitors know they
 * can try posting without affecting a real family.
 */
export function HomepageDemoToast(props: HomepageDemoToastProps) {
  const { t } = useI18n();
  const dismissed = homepageDemoDismissals.useIsDismissed(props.publicId);
  if (!isHomepageDemoPublicId(props.publicId) || dismissed) return null;

  return (
    <aside {...stylex.props(styles.aside)} aria-live="polite">
      <div {...stylex.props(styles.shell)}>
        <Item variant="outline">
          <div {...stylex.props(styles.media)}>
            <Info {...stylex.props(styles.icon)} />
          </div>
          <ItemContent>
            <ItemTitle>{t("This is a demo baby")}</ItemTitle>
            <ItemDescription>
              {t("Feel free to post test messages — we reset this demo daily.")}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              variant="ghost"
              size="icon"
              shape="pill"
              aria-label={t("Hide tip")}
              onClick={() => homepageDemoDismissals.dismiss(props.publicId)}
            >
              <X />
            </Button>
          </ItemActions>
        </Item>
      </div>
    </aside>
  );
}
