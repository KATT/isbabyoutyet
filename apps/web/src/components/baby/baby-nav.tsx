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
  /** Dashboard link for signed-in visitors. Null when logged out. */
  dashboardButton: LinkProps | null;
  /** When post-update is open, dismiss via history.back / replace fallback. */
  onDismissPostUpdate: (() => void) | null;
  /** When settings is open, dismiss via history.back / replace fallback. */
  onDismissSettings: (() => void) | null;
  /** When share is open, dismiss via history.back / replace fallback. */
  onDismissShare: (() => void) | null;
  /** When login is open, dismiss via history.back / replace fallback. */
  onDismissSignIn: (() => void) | null;
  /** Fired when the owner opens Settings from the gear (not from a URL deep-link) */
  onSettingsOpened: (() => void) | null;
  /** Open post-update link (push). Null when the visitor cannot manage. */
  postUpdateButton: LinkProps | null;
  postUpdateOpen: boolean;
  /** Open-settings link (push). Null when the visitor cannot manage. */
  settingsButton: LinkProps | null;
  settingsOpen: boolean;
  /** Open-share link (push). Null when sharing is unavailable. */
  shareButton: LinkProps | null;
  shareOpen: boolean;
  /** Open parent login overlay. Null when the visitor is signed in. */
  signInButton: LinkProps | null;
  signInOpen: boolean;
};

export function BabyNav(props: BabyNavProps) {
  const { t } = useI18n();
  const hasOwnerActions = !!(props.postUpdateButton || props.settingsButton);

  const ownerActions = hasOwnerActions ? (
    <div aria-label={t("Owner actions")} className="flex items-center gap-1" role="group">
      {props.postUpdateButton && (
        <Tooltip>
          <TooltipTrigger
            render={
              props.postUpdateOpen && props.onDismissPostUpdate ? (
                <Button
                  className={postUpdateButtonClassName}
                  data-tour-id="post_update"
                  onClick={props.onDismissPostUpdate}
                  variant="default"
                >
                  <PostUpdateLabel label={t("Post update")} />
                </Button>
              ) : (
                <Button
                  className={postUpdateButtonClassName}
                  data-tour-id="post_update"
                  nativeButton={false}
                  render={<Link {...props.postUpdateButton} />}
                  variant="ghost"
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
                  aria-label={t("Close settings")}
                  className="rounded-full"
                  data-tour-id="explore_settings"
                  onClick={props.onDismissSettings}
                  size="icon"
                  variant="default"
                >
                  <GearSix />
                </Button>
              ) : (
                <Button
                  aria-label={t("Settings")}
                  className="rounded-full"
                  data-tour-id="explore_settings"
                  nativeButton={false}
                  onClick={() => {
                    props.onSettingsOpened?.();
                  }}
                  render={<Link {...props.settingsButton} />}
                  size="icon"
                  variant="ghost"
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
              aria-label={t("Sign in")}
              className="rounded-full"
              onClick={props.onDismissSignIn}
              size="icon"
              variant="default"
            >
              <SignIn />
            </Button>
          ) : (
            <Button
              aria-label={t("Sign in")}
              className="rounded-full"
              nativeButton={false}
              render={<Link {...props.signInButton} />}
              size="icon"
              variant="ghost"
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
            aria-label={t("Dashboard")}
            className="rounded-full"
            nativeButton={false}
            render={<Link {...props.dashboardButton} />}
            size="icon"
            variant="ghost"
          >
            <House />
          </Button>
        }
      />
      <TooltipContent>{t("Dashboard")}</TooltipContent>
    </Tooltip>
  ) : null;

  const pageActions = (
    <div aria-label={t("Page actions")} className="flex items-center gap-1" role="group">
      <Tooltip>
        <TooltipTrigger
          render={
            props.shareOpen && props.onDismissShare ? (
              <Button
                aria-label={t("Close share preview")}
                className="rounded-full"
                data-tour-id="share_link"
                onClick={props.onDismissShare}
                size="icon"
                variant="default"
              >
                <ShareNetwork />
              </Button>
            ) : (
              <Button
                aria-label={t("Share the link")}
                className="rounded-full"
                data-tour-id="share_link"
                disabled={!props.shareButton}
                nativeButton={!props.shareButton}
                render={props.shareButton ? <Link {...props.shareButton} /> : undefined}
                size="icon"
                variant="ghost"
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
      {ownerActions && <span aria-hidden="true" className="h-5 w-px bg-border" />}
      {pageActions}
    </div>
  );
}
