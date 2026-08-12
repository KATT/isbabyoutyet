import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { CheckCircle, MessageCircleHeart, Settings, Share2 } from "lucide-react";
import { Link, LinkProps } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";

type BabyNavProps = {
  shareLink: null | string;
  settingsButton: null | LinkProps;
  settingsOpen: boolean;
  /** Owner-only "Post update" link; open state is mirrored in the URL search */
  postUpdateButton?: null | LinkProps;
  postUpdateOpen?: boolean;
  /** Fired after the share URL is copied (used by the first-run tour) */
  onShareCopied?: () => void;
};

export function BabyNav({
  shareLink,
  settingsButton,
  settingsOpen,
  postUpdateButton,
  postUpdateOpen,
  onShareCopied,
}: BabyNavProps) {
  const [copied, setCopied] = useState(false);
  const hasOwnerActions = !!(postUpdateButton || settingsButton);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const ownerActions = hasOwnerActions ? (
    <ButtonGroup aria-label="Owner actions">
      {postUpdateButton && (
        <Button
          variant={postUpdateOpen ? "default" : "outline"}
          render={<Link {...(postUpdateButton as any)} />}
          nativeButton={false}
          data-tour-id="post_update"
        >
          <MessageCircleHeart data-icon="inline-start" />
          Post update
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
                aria-label={settingsOpen ? "Close settings" : "Settings"}
                data-tour-id="explore_settings"
              >
                <Settings />
              </Button>
            }
          />
          <TooltipContent>{settingsOpen ? "Close settings" : "Settings"}</TooltipContent>
        </Tooltip>
      )}
    </ButtonGroup>
  ) : null;

  const pageActions = (
    <ButtonGroup aria-label="Page actions">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              onClick={async () => {
                if (!shareLink) return;
                try {
                  await navigator.clipboard.writeText(shareLink);
                  setCopied(true);
                  toast.success("Copied to clipboard");
                  onShareCopied?.();
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
                    toast.success("Copied to clipboard");
                    onShareCopied?.();
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
              aria-label={copied ? "Copied!" : "Copy link to share"}
              data-tour-id="share_link"
            >
              {copied ? <CheckCircle /> : <Share2 />}
            </Button>
          }
        />
        <TooltipContent>{copied ? "Copied!" : "Copy link to share"}</TooltipContent>
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
