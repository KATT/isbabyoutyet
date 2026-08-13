import { Button } from "@workspace/ui/components/button";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { ChatCircleText, CheckCircle, GearSix, ShareNetwork } from "@phosphor-icons/react";
import { Link, LinkProps } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";

type BabyNavProps = {
  shareLink: null | string;
  settingsButton: null | LinkProps;
  settingsOpen: boolean;
  /** Owner-only "Post update" action */
  onPostUpdate?: (() => void) | null;
  className?: string;
};

export function BabyNav({
  shareLink,
  settingsButton,
  settingsOpen,
  onPostUpdate,
  className,
}: BabyNavProps) {
  const [copied, setCopied] = useState(false);
  const hasOwnerActions = !!(onPostUpdate || settingsButton);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const ownerActions = hasOwnerActions ? (
    <div role="group" aria-label="Owner actions" className="flex items-center gap-1">
      {onPostUpdate && (
        <Button variant="ghost" className="rounded-full font-bold" onClick={onPostUpdate}>
          <ChatCircleText data-icon="inline-start" />
          Post update
        </Button>
      )}
      {settingsButton && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={settingsOpen ? "default" : "ghost"}
                size="icon"
                className="rounded-full"
                render={<Link {...(settingsButton as any)} />}
                nativeButton={false}
                aria-label={settingsOpen ? "Close settings" : "Settings"}
              >
                <GearSix />
              </Button>
            }
          />
          <TooltipContent>{settingsOpen ? "Close settings" : "Settings"}</TooltipContent>
        </Tooltip>
      )}
    </div>
  ) : null;

  const pageActions = (
    <div role="group" aria-label="Page actions" className="flex items-center gap-1">
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
                  } catch (cause) {
                    toast.error(
                      "Failed to copy to clipboard: " +
                        (cause instanceof Error ? cause.message : "Unknown error"),
                    );
                  }
                  document.body.removeChild(textArea);
                }
              }}
              variant="ghost"
              size="icon"
              className="rounded-full"
              disabled={!shareLink}
              aria-label={copied ? "Copied!" : "Copy link to share"}
            >
              {copied ? <CheckCircle /> : <ShareNetwork />}
            </Button>
          }
        />
        <TooltipContent>{copied ? "Copied!" : "Copy link to share"}</TooltipContent>
      </Tooltip>

      <ModeToggle className="rounded-full" />
    </div>
  );

  // A floating pill dock; the page decides where it sits
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border-2 border-border bg-background/85 p-1 backdrop-blur-md shadow-sm",
        className,
      )}
    >
      {ownerActions}
      {ownerActions && <span className="h-5 w-px bg-border" aria-hidden="true" />}
      {pageActions}
    </div>
  );
}
