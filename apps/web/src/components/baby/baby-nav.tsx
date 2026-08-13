import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { CheckCircle, MessageCircleHeart, Settings, Share2 } from "lucide-react";
import { Link, LinkProps } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";
import { useI18n } from "@/lib/i18n";

type BabyNavProps = {
  shareLink: null | string;
  settingsButton: null | LinkProps;
  settingsOpen: boolean;
  /** Owner-only "Post update" link; open state is mirrored in the URL search */
  postUpdateButton?: null | LinkProps;
  postUpdateOpen?: boolean;
};

export function BabyNav({
  shareLink,
  settingsButton,
  settingsOpen,
  postUpdateButton,
  postUpdateOpen,
}: BabyNavProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const hasOwnerActions = !!(postUpdateButton || settingsButton);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const ownerActions = hasOwnerActions ? (
    <ButtonGroup aria-label={t("Owner actions")}>
      {postUpdateButton && (
        <Button
          variant={postUpdateOpen ? "default" : "outline"}
          render={<Link {...(postUpdateButton as any)} />}
          nativeButton={false}
        >
          <MessageCircleHeart data-icon="inline-start" />
          {t("Post update")}
        </Button>
      )}
      {settingsButton && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={settingsOpen ? "default" : "outline"}
                size="icon"
                render={<Link {...(settingsButton as any)} />}
                nativeButton={false}
                aria-label={settingsOpen ? t("Close settings") : t("Settings")}
              >
                <Settings />
              </Button>
            }
          />
          <TooltipContent>{settingsOpen ? t("Close settings") : t("Settings")}</TooltipContent>
        </Tooltip>
      )}
    </ButtonGroup>
  ) : null;

  const pageActions = (
    <ButtonGroup aria-label={t("Page actions")}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              onClick={async () => {
                if (!shareLink) return;
                try {
                  await navigator.clipboard.writeText(shareLink);
                  setCopied(true);
                  toast.success(t("Copied to clipboard"));
                } catch {
                  // Fallback for older browsers
                  const textArea = document.createElement("textarea");
                  textArea.value = shareLink;
                  textArea.style.position = "fixed";
                  textArea.style.opacity = "0";
                  document.body.appendChild(textArea);
                  textArea.select();
                  try {
                    document.execCommand("copy");
                    setCopied(true);
                    toast.success(t("Copied to clipboard"));
                  } catch (cause) {
                    toast.error(
                      "Failed to copy to clipboard: " +
                        (cause instanceof Error ? cause.message : "Unknown error"),
                    );
                  }
                  document.body.removeChild(textArea);
                }
              }}
              variant="outline"
              size="icon"
              disabled={!shareLink}
              aria-label={copied ? t("Copied!") : t("Copy link to share")}
            >
              {copied ? <CheckCircle /> : <Share2 />}
            </Button>
          }
        />
        <TooltipContent>{copied ? t("Copied!") : t("Copy link to share")}</TooltipContent>
      </Tooltip>

      <ModeToggle className="rounded-lg" />
    </ButtonGroup>
  );

  return (
    <div
      className={cn(
        // general
        "p-4 z-10",
        // mobile
        "fixed bottom-0 left-0",
        // desktop
        "md:sticky md:top-0 md:left-0",
      )}
    >
      <ButtonGroup>
        {ownerActions}
        {pageActions}
      </ButtonGroup>
    </div>
  );
}
