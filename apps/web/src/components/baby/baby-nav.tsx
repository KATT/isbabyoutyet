import { Button } from "@workspace/ui/components/button";
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
};

export function BabyNav({
  shareLink,
  settingsButton,
  settingsOpen,
  postUpdateButton,
  postUpdateOpen,
}: BabyNavProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <div
      className={cn(
        // general
        "gap-2 p-4 z-10 flex",
        // mobile
        "fixed bottom-0 left-0",
        // desktop
        "md:sticky md:top-0 md:left-0",
      )}
    >
      {postUpdateButton && (
        <Button
          className="rounded-full shadow-lg shadow-primary/20"
          variant={postUpdateOpen ? "default" : undefined}
          render={<Link {...(postUpdateButton as any)} />}
          nativeButton={false}
        >
          <MessageCircleHeart className="w-4 h-4" />
          Post update
        </Button>
      )}

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
              variant="outline"
              size="icon"
              className="rounded-full"
              disabled={!shareLink}
            >
              {copied ? <CheckCircle className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </Button>
          }
        />
        <TooltipContent>{copied ? "Copied!" : "Copy link to share"}</TooltipContent>
      </Tooltip>

      <ModeToggle />

      {settingsButton && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={settingsOpen ? "default" : "outline"}
                size="icon"
                className="rounded-full"
                render={<Link {...(settingsButton as any)} />}
                nativeButton={false}
              >
                <Settings className="w-4 h-4" />
              </Button>
            }
          />
          <TooltipContent>{settingsOpen ? "Close settings" : "Settings"}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
