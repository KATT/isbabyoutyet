import { Button } from "@workspace/ui/components/button";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { ChatCircleText, GearSix, ShareNetwork } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

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

export function BabyNav(props: BabyNavProps) {
  const { t } = useI18n();
  const hasOwnerActions = !!(props.postUpdateButton || props.settingsButton);

  const ownerActions = hasOwnerActions ? (
    <div role="group" aria-label={t("Owner actions")} className="flex items-center gap-1">
      {props.postUpdateButton &&
        (props.postUpdateOpen && props.onDismissPostUpdate ? (
          <Button
            variant="default"
            className="rounded-full font-bold"
            data-tour-id="post_update"
            onClick={props.onDismissPostUpdate}
          >
            <ChatCircleText data-icon="inline-start" />
            {t("Post update")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="rounded-full font-bold"
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
                  className="rounded-full"
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
                  className="rounded-full"
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
    </div>
  ) : null;

  const pageActions = (
    <div role="group" aria-label={t("Page actions")} className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            props.shareOpen && props.onDismissShare ? (
              <Button
                variant="default"
                size="icon"
                className="rounded-full"
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
                className="rounded-full"
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

      <ModeToggle className="rounded-full" />
    </div>
  );

  // A floating pill dock; the page decides where it sits
  return (
    <div className="flex items-center gap-1 rounded-full border-2 border-border bg-background/85 p-1 backdrop-blur-md shadow-sm">
      {ownerActions}
      {ownerActions && <span className="h-5 w-px bg-border" aria-hidden="true" />}
      {pageActions}
    </div>
  );
}
