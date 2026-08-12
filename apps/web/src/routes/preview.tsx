import { Separator } from "@workspace/ui/components/separator";
import { AppHeader } from "@/components/baby/app-header";
import { BabyNav } from "@/components/baby/baby-nav";
import { ProgressIndicator } from "@/components/baby/progress-indicator";
import { SettingsPanel } from "@/components/baby/settings-panel";
import { StatusDisplay } from "@/components/baby/status-display";
import type { BabyData } from "@workspace/convex/src/types";
import { getCurrentStatus } from "@workspace/convex/src/types";
import { getThemeCssUrl } from "@/components/baby/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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

      <div className="min-h-screen bg-background">
        <AppHeader>
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
        </AppHeader>

        <main className="mx-auto w-full max-w-xl px-4 py-8 md:py-12">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Is {baby.name} out yet?
          </h1>

          <section className="mt-8 rounded-xl border border-border/70 bg-card p-5 md:p-6">
            <StatusDisplay baby={baby} currentStatus={currentStatus} latestUpdate={latestUpdate} />
            <Separator className="my-6" />
            <ProgressIndicator baby={baby} currentStatus={currentStatus} />
          </section>
        </main>

        <footer className="border-t border-border/60 py-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 px-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Having a baby? Are people messaging you non-stop? Create your own page →
          </Link>
        </footer>
      </div>
    </div>
  );
}
