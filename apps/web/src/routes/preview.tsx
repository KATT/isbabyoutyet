import { Card, CardContent, CardFooter } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import { BabyNav } from "@/components/baby/baby-nav";
import { ProgressIndicator } from "@/components/baby/progress-indicator";
import { SettingsPanel } from "@/components/baby/settings-panel";
import { StatusDisplay } from "@/components/baby/status-display";
import type { BabyData } from "@workspace/convex/src/types";
import { getCurrentStatus } from "@workspace/convex/src/types";
import { getThemeCssUrl } from "@/components/baby/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { translate, useI18n } from "@/lib/i18n";

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
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    hospitalMessage: null,
    babyBornMessage: null,
    laborStartedMessage: null,
    photoId: null,
  };
}
const searchSchema = z.object({
  name: z.string().default("Baby"),
  dueDate: z.string().optional(),
  theme: z.string().nullable().optional(),
  laborStarted: z.string().nullable().optional(),
  wentToHospital: z.string().nullable().optional(),
  babyBorn: z.string().nullable().optional(),
  hospitalMessage: z.string().nullable().optional(),
  babyBornMessage: z.string().nullable().optional(),
  laborStartedMessage: z.string().nullable().optional(),
  settings: z.boolean().optional(),
});

export const Route = createFileRoute("/preview")({
  component: PreviewPage,
  validateSearch: searchSchema,
  head: (opts) => ({
    meta: [
      {
        title: translate(opts.match.context.locale, "Preview – {{title}}", {
          title: translate(
            opts.match.context.locale,
            "Is Baby Out Yet? – Share Your Baby's Arrival",
          ),
        }),
      },
      {
        name: "description",
        content: translate(
          opts.match.context.locale,
          "Preview how your baby tracking page will look at different stages.",
        ),
      },
    ],
  }),
});

function PreviewPage() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const baby: BabyData = {
    ...getDefaultBabyData(),
    ...search,
  };
  const currentStatus = getCurrentStatus(baby);
  const themeCssUrl = getThemeCssUrl(baby.theme);

  // The preview has no timeline; simulate the latest update from the stage message
  const stageMessage =
    currentStatus.type === "born"
      ? baby.babyBornMessage
      : currentStatus.type === "gone_to_hospital"
        ? baby.hospitalMessage
        : currentStatus.type === "labor_started"
          ? baby.laborStartedMessage
          : null;
  const latestUpdate =
    currentStatus.type !== "not_yet" && stageMessage
      ? { message: stageMessage, postedAt: Date.parse(currentStatus.date) }
      : null;

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
        open={!!search.settings}
        onOpenChange={(open) => {
          void navigate({
            search: {
              ...search,
              settings: open || undefined,
            },
            replace: true,
          });
        }}
      />

      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Gradient Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="border-b border-border/50">
          <BabyNav
            shareLink={null}
            settingsButton={{
              to: "/preview",
              search: {
                ...search,
                settings: search.settings ? undefined : true,
              },
            }}
            settingsOpen={!!search.settings}
          />

          <h1 className="text-4xl md:text-7xl font-black text-foreground tracking-tight whitespace-nowrap py-6 md:py-10 px-6 text-center">
            <span className="bg-linear-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
              {t("Is {{name}} out yet?", { name: baby.name })}
            </span>
          </h1>
        </div>

        <section className="relative px-6 py-12 text-center overflow-hidden">
          <div className="relative max-w-5xl mx-auto">
            <Card>
              <CardContent>
                <StatusDisplay
                  baby={baby}
                  currentStatus={currentStatus}
                  latestUpdate={latestUpdate}
                />
                <Separator />
              </CardContent>
              <CardFooter>
                <ProgressIndicator baby={baby} currentStatus={currentStatus} />
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* Footer: extra bottom padding on mobile clears the fixed bottom bar */}
        <div className="text-center pt-8 pb-28 md:pb-8 border-t border-border/50">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("Having a baby? Are people messaging you non-stop? Create your own page →")}
          </Link>
        </div>
      </div>
    </div>
  );
}
