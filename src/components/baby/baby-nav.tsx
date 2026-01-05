import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, Settings, Share2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type BabyNavProps = {
  shareButton?: {
    enabled: boolean;
    url?: string;
  };
  settingsButton?: {
    visible: boolean;
    isOpen: boolean;
    onToggle?: () => void;
    linkTo?: string;
    linkParams?: Record<string, string>;
    linkSearch?: Record<string, unknown>;
  };
  className?: string;
};

export function BabyNav({ shareButton, settingsButton, className }: BabyNavProps) {
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
        "md:absolute md:top-0 md:left-0",
        className,
      )}
    >
      {shareButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={
                shareButton.enabled && shareButton.url
                  ? async () => {
                      try {
                        await navigator.clipboard.writeText(shareButton.url!);
                        setCopied(true);
                        toast.success("Copied to clipboard");
                      } catch {
                        // Fallback for older browsers
                        const textArea = document.createElement("textarea");
                        textArea.value = shareButton.url!;
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
                    }
                  : undefined
              }
              variant="outline"
              size="icon"
              className="rounded-full"
              disabled={!shareButton.enabled}
            >
              {copied ? <CheckCircle className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {shareButton.enabled
              ? copied
                ? "Copied!"
                : "Copy link to share"
              : "Share (preview mode)"}
          </TooltipContent>
        </Tooltip>
      )}

      <ModeToggle />

      {settingsButton?.visible && (
        <Tooltip>
          <TooltipTrigger asChild>
            {settingsButton.linkTo ? (
              <Button
                asChild
                variant={settingsButton.isOpen ? "default" : "outline"}
                size="icon"
                className="rounded-full"
              >
                <Link
                  to={settingsButton.linkTo}
                  params={settingsButton.linkParams}
                  search={settingsButton.linkSearch}
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </Button>
            ) : (
              <Button
                onClick={settingsButton.onToggle}
                variant={settingsButton.isOpen ? "default" : "outline"}
                size="icon"
                className="rounded-full"
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent>
            {settingsButton.isOpen ? "Hide settings" : "Show settings"}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
