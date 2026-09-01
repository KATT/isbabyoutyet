import { Button } from "@workspace/ui/components/button";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { ChatCircleText, GearSix, House, ShareNetwork, SignIn } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

const postUpdateButtonClassName =
  "rounded-full font-bold max-sm:size-8 max-sm:gap-0 max-sm:px-0 max-sm:has-data-[icon=inline-start]:pl-0";

function PostUpdateLabel(props: { label: string }) {
  return (
    <>
      <ChatCircleText data-icon="inline-start" />
      <span className="max-sm:sr-only">{props.label}</span>
    </>
  );
}

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
  /** Open parent login overlay. Null when the visitor is signed in. */
  signInButton: LinkProps | null;
  signInOpen: boolean;
  /** When login is open, dismiss via history.back / replace fallback. */
  onDismissSignIn: (() => void) | null;
  /** Dashboard link for signed-in visitors. Null when logged out. */
  dashboardButton: LinkProps | null;
};

export function BabyNav(props: BabyNavProps) {
  const { t } = useI18n();
  const hasOwnerActions = !!(props.postUpdateButton || props.settingsButton);

  const ownerActions = hasOwnerActions ? (
    <div role="group" aria-label={t("Owner actions")} className="flex items-center gap-1">
      {props.postUpdateButton && (
        <Tooltip>
          <TooltipTrigger
            render={
              props.postUpdateOpen && props.onDismissPostUpdate ? (
                <Button
                  variant="default"
                  className={postUpdateButtonClassName}
                  data-tour-id="post_update"
                  onClick={props.onDismissPostUpdate}
                >
                  <PostUpdateLabel label={t("Post update")} />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className={postUpdateButtonClassName}
                  render={<Link {...props.postUpdateButton} />}
                  nativeButton={false}
                  data-tour-id="post_update"
                >
                  <PostUpdateLabel label={t("Post update")} />
                </Button>
              )
            }
          />
          <TooltipContent>{t("Post update")}</TooltipContent>
        </Tooltip>
      )}
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
                  render={<Link {...props.settingsButton} />}
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

  const accountAction = props.signInButton ? (
    <Tooltip>
      <TooltipTrigger
        render={
          props.signInOpen && props.onDismissSignIn ? (
            <Button
              variant="default"
              size="icon"
              className="rounded-full"
              aria-label={t("Sign in")}
              onClick={props.onDismissSignIn}
            >
              <SignIn />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              render={<Link {...props.signInButton} />}
              nativeButton={false}
              aria-label={t("Sign in")}
            >
              <SignIn />
            </Button>
          )
        }
      />
      <TooltipContent>{t("Sign in")}</TooltipContent>
    </Tooltip>
  ) : props.dashboardButton ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            render={<Link {...props.dashboardButton} />}
            nativeButton={false}
            aria-label={t("Dashboard")}
          >
            <House />
          </Button>
        }
      />
      <TooltipContent>{t("Dashboard")}</TooltipContent>
    </Tooltip>
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
                render={props.shareButton ? <Link {...props.shareButton} /> : undefined}
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
      {accountAction}
    </div>
  );

  // A floating pill dock; the page decides where it sits
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border-2 border-border bg-background/85 p-1 backdrop-blur-md shadow-sm">
      {ownerActions}
      {ownerActions && <span className="h-5 w-px bg-border" aria-hidden="true" />}
      {pageActions}
    </div>
  );
}
