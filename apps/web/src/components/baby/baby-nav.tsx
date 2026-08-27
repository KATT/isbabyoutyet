import { Button } from "@workspace/ui/components/button";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Inline } from "@workspace/ui-patterns/components/inline";
import { ChatCircleText, GearSix, ShareNetwork } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import * as stylex from "@stylexjs/stylex";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";

type BabyNavProps = {
  /** Open-share link (push). Null when sharing is unavailable. */
  shareButton: LinkProps | null;
  shareOpen: boolean;
  /** When share is open, dismiss via history.back / replace fallback. */
  onDismissShare: (() => void) | null;
  /** Open-settings link (push). Null when the visitor cannot manage. */
  settingsButton: LinkProps | null;
  settingsOpen: boolean;
  /** When settings is open, dismiss via history.back / replace fallback. */
  onDismissSettings: (() => void) | null;
  /** Open post-update link (push). Null when the visitor cannot manage. */
  postUpdateButton: LinkProps | null;
  postUpdateOpen: boolean;
  /** When post-update is open, dismiss via history.back / replace fallback. */
  onDismissPostUpdate: (() => void) | null;
  /** Fired when the owner opens Settings from the gear (not from a URL deep-link) */
  onSettingsOpened: (() => void) | null;
};

const styles = stylex.create({
  dock: {
    alignItems: "center",
    backdropFilter: "blur(12px)",
    backgroundColor: `color-mix(in oklab, ${colors.background} 85%, transparent)`,
    borderColor: colors.border,
    borderRadius: "9999px",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    display: "flex",
    gap: spacing.s1,
    padding: spacing.s1,
  },
  divider: {
    backgroundColor: colors.border,
    height: "1.25rem",
    width: "1px",
  },
});

export function BabyNav(props: BabyNavProps) {
  const { t } = useI18n();
  const hasOwnerActions = !!(props.postUpdateButton || props.settingsButton);

  const ownerActions = hasOwnerActions ? (
    <Inline gap="s1" wrap={false} role="group" aria-label={t("Owner actions")}>
      {props.postUpdateButton &&
        (props.postUpdateOpen && props.onDismissPostUpdate ? (
          <Button
            variant="default"
            shape="pill"
            weight="bold"
            data-tour-id="post_update"
            onClick={props.onDismissPostUpdate}
          >
            <ChatCircleText data-icon="inline-start" />
            {t("Post update")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            shape="pill"
            weight="bold"
            render={<Link {...(props.postUpdateButton as any)} />}
            nativeButton={false}
            data-tour-id="post_update"
          >
            <ChatCircleText data-icon="inline-start" />
            {t("Post update")}
          </Button>
        ))}
      {props.settingsButton && (
        <Tooltip>
          <TooltipTrigger
            render={
              props.settingsOpen && props.onDismissSettings ? (
                <Button
                  variant="default"
                  size="icon"
                  shape="pill"
                  aria-label={t("Close settings")}
                  data-tour-id="explore_settings"
                  onClick={props.onDismissSettings}
                >
                  <GearSix />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  shape="pill"
                  render={<Link {...(props.settingsButton as any)} />}
                  nativeButton={false}
                  aria-label={t("Settings")}
                  data-tour-id="explore_settings"
                  onClick={() => {
                    props.onSettingsOpened?.();
                  }}
                >
                  <GearSix />
                </Button>
              )
            }
          />
          <TooltipContent>
            {props.settingsOpen ? t("Close settings") : t("Settings")}
          </TooltipContent>
        </Tooltip>
      )}
    </Inline>
  ) : null;

  const pageActions = (
    <Inline gap="s1" wrap={false} role="group" aria-label={t("Page actions")}>
      <Tooltip>
        <TooltipTrigger
          render={
            props.shareOpen && props.onDismissShare ? (
              <Button
                variant="default"
                size="icon"
                shape="pill"
                aria-label={t("Close share preview")}
                data-tour-id="share_link"
                onClick={props.onDismissShare}
              >
                <ShareNetwork />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                shape="pill"
                render={props.shareButton ? <Link {...(props.shareButton as any)} /> : undefined}
                nativeButton={!props.shareButton}
                disabled={!props.shareButton}
                aria-label={t("Share the link")}
                data-tour-id="share_link"
              >
                <ShareNetwork />
              </Button>
            )
          }
        />
        <TooltipContent>
          {props.shareOpen ? t("Close share preview") : t("Share the link")}
        </TooltipContent>
      </Tooltip>

      <ModeToggle />
    </Inline>
  );

  return (
    <div {...stylex.props(styles.dock)}>
      {ownerActions}
      {ownerActions && <span {...stylex.props(styles.divider)} aria-hidden="true" />}
      {pageActions}
    </div>
  );
}
