import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProgressIndicator } from "@/components/baby/progress-indicator";
import { SettingsPanel } from "@/components/baby/settings-panel";
import { StatusDisplay } from "@/components/baby/status-display";
import type { BabyData } from "@/components/baby/types";
import { getCurrentStatus } from "@/components/baby/types";
import { getThemeCssUrl } from "@/components/baby/utils";
import { cn } from "@/lib/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RotateCcw, Settings, Share2 } from "lucide-react";
import { z } from "zod";

function getDefaultBabyData(): BabyData {
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 7);
  const laborStarted = new Date(now);
  laborStarted.setHours(laborStarted.getHours() - 2);

  return {
    name: "Baby",
    dueDate: dueDate.toISOString(),
    theme: null,
    laborStarted: laborStarted.toISOString(),
    wentToHospital: null,
    babyBorn: null,
    customMessage: null,
    babyBornMessage: null,
  };
}
const searchSchema = z.object({
  name: z.string().default("Baby"),
  dueDate: z.string().optional(),
  theme: z.string().nullable().optional(),
  laborStarted: z.string().nullable().optional(),
  wentToHospital: z.string().nullable().optional(),
  babyBorn: z.string().nullable().optional(),
  customMessage: z.string().nullable().optional(),
  babyBornMessage: z.string().nullable().optional(),
  settings: z.boolean().default(true),
});

export const Route = createFileRoute("/preview")({
  component: PreviewPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      {
        title: "Preview - Is Baby Out Yet?",
      },
      {
        name: "description",
        content: "Preview how your baby tracking page will look at different stages.",
      },
    ],
  }),
});

function PreviewPage() {
  const { settings, ...search } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const baby: BabyData = {
    ...getDefaultBabyData(),
    ...search,
  };
  const currentStatus = getCurrentStatus(baby);
  const themeCssUrl = getThemeCssUrl(baby.theme);

  return (
    <div>
      {themeCssUrl && <link rel="stylesheet" href={themeCssUrl} />}
      <SettingsPanel
        baby={baby}
        onUpdate={(update) => {
          navigate({
            search: {
              ...search,
              ...update,
            },
            replace: true,
          });
        }}
        isOpen={settings}
      />

      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Gradient Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="border-b border-border/50">
          {/* Nav content */}
          <div
            className={cn(
              // general
              "gap-2 p-4 z-10 flex",
              // mobile
              "fixed bottom-0 left-0",
              // desktop
              "md:absolute md:top-0 md:left-0",
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full" disabled>
                  <Share2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share (preview mode)</TooltipContent>
            </Tooltip>
            <ModeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    navigate({
                      search: { ...search, settings: !settings },
                      replace: true,
                    });
                  }}
                  variant={settings ? "default" : "outline"}
                  size="icon"
                  className="rounded-full"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{settings ? "Hide settings" : "Show settings"}</TooltipContent>
            </Tooltip>
          </div>

          <h1 className="text-4xl md:text-7xl font-black text-foreground tracking-tight whitespace-nowrap py-6 md:py-10 px-6 text-center">
            <span className="bg-linear-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
              Is {baby.name} out yet?
            </span>
          </h1>
        </div>

        <section className="relative px-6 py-12 text-center overflow-hidden">
          <div className="relative max-w-5xl mx-auto">
            <Card>
              <CardContent>
                <StatusDisplay baby={baby} currentStatus={currentStatus} />
                <Separator />
              </CardContent>
              <CardFooter>
                <ProgressIndicator baby={baby} currentStatus={currentStatus} />
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-8 border-t border-border/50">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Having a baby? Are people messaging you non-stop? Create your own page →
          </Link>
        </div>
      </div>
    </div>
  );
}
