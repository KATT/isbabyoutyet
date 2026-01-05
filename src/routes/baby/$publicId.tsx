import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Separator } from "@/components/ui/separator";
import { ProgressIndicator } from "@/components/baby/progress-indicator";
import { SettingsPanel } from "@/components/baby/settings-panel";
import { StatusDisplay } from "@/components/baby/status-display";
import type { BabyData } from "@/components/baby/types";
import { getCurrentStatus } from "@/components/baby/types";
import {
  getDaysUntilDueDate,
  getOverdueDays,
  getThemeCssUrl,
  getThemePrimaryColor,
} from "@/components/baby/utils";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import type { Doc } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle, Settings, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/baby/$publicId")({
  component: BabyPage,
  validateSearch: z.object({
    settings: z.boolean().optional(),
  }),
  loader: async (opts) => {
    const baby = await opts.context.convexClient.query(api.baby.getByPublicId, {
      publicId: opts.params.publicId,
    });
    if (!baby) {
      throw notFound();
    }
    return {
      baby,
    };
  },
  head: (opts) => {
    const baby = opts.loaderData?.baby;
    if (!baby) {
      return {
        meta: [
          {
            title: "Is Baby Out Yet? - Track Your Baby's Journey",
          },
          {
            name: "description",
            content: "Track the progress of labor and birth - know when baby arrives!",
          },
          {
            name: "theme-color",
            content: "#ea580c",
          },
        ],
      };
    }

    const overdueDays = getOverdueDays(baby.dueDate);
    const daysUntilDueDate = getDaysUntilDueDate(baby.dueDate);
    const isBorn = !!baby.babyBorn;

    let title = `Is ${baby.name} out yet?`;
    if (!isBorn) {
      if (overdueDays > 0) {
        title = `${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue - Is ${baby.name} out yet?`;
      } else {
        title = `${daysUntilDueDate} ${daysUntilDueDate === 1 ? "day" : "days"} until due date - Is ${baby.name} out yet?`;
      }
    }
    title = `${title} - Track Your Baby's Journey`;

    const description = `Track ${baby.name}'s journey - know when baby arrives!`;

    const themeColor = getThemePrimaryColor(baby.theme);

    return {
      meta: [
        {
          title,
        },
        {
          name: "description",
          content: description,
        },
        {
          name: "theme-color",
          content: themeColor,
        },
      ],
    };
  },
});

/**
 * Convert Convex Doc to BabyData for use with shared components
 */
function docToBabyData(doc: Doc<"baby">): BabyData {
  return {
    name: doc.name,
    dueDate: doc.dueDate,
    theme: (doc.theme ?? null) as BabyData["theme"],
    laborStarted: doc.laborStarted ?? null,
    wentToHospital: doc.wentToHospital ?? null,
    babyBorn: doc.babyBorn ?? null,
    customMessage: doc.customMessage ?? null,
    babyBornMessage: doc.babyBornMessage ?? null,
  };
}

function NavContent(props: { baby: Doc<"baby">; isOwner: boolean }) {
  const params = Route.useParams();
  const search = Route.useSearch();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;

    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <>
      <Button
        onClick={async () => {
          const url = `${window.location.origin}/baby/${props.baby.publicId}`;
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);

            toast.success("Copied to clipboard");
          } catch {
            // Fallback for older browsers
            const textArea = document.createElement("textarea");
            textArea.value = url;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.select();
            try {
              document.execCommand("copy");
              setCopied(true);

              toast.success("Copied to clipboard");
            } catch (cause) {
              // Handle error
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
      >
        {copied ? <CheckCircle className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
      </Button>
      <ModeToggle />
      {props.isOwner && (
        <Button
          asChild
          variant={search.settings ? "default" : "outline"}
          size="icon"
          className="rounded-full"
        >
          <Link
            to="/baby/$publicId"
            params={{ publicId: params.publicId }}
            search={search.settings ? {} : { settings: true }}
          >
            <Settings className="w-4 h-4" />
          </Link>
        </Button>
      )}
    </>
  );
}

function BabyPage() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const loaderData = Route.useLoaderData();
  // Use prefetched data if available, otherwise use reactive query
  const queryBaby = useQuery(api.baby.getByPublicId, { publicId: params.publicId });
  // Prefer query result (reactive) over prefetched data, but use prefetched as fallback
  const babyDoc = queryBaby ?? loaderData.baby;
  const baby = docToBabyData(babyDoc);
  const themeCssUrl = getThemeCssUrl(baby.theme);
  const sessionResult = authClient.useSession();
  const updateBaby = useMutation(api.baby.update);

  // Redirect if baby found but current publicId doesn't match (client-side check)
  useEffect(() => {
    if (babyDoc && babyDoc.publicId !== params.publicId) {
      navigate({
        to: "/baby/$publicId",
        params: { publicId: babyDoc.publicId },
        replace: true,
      });
    }
  }, [babyDoc, params.publicId, navigate]);

  // Better-auth user ID is in session.user.id, but Convex uses identity.subject which is the same
  const isOwner = sessionResult.data?.user?.id === babyDoc.userId;

  const currentStatus = getCurrentStatus(baby);

  return (
    <div>
      {themeCssUrl && <link rel="stylesheet" href={themeCssUrl} />}

      {isOwner && (
        <SettingsPanel
          baby={baby}
          onUpdate={async (update) => {
            await updateBaby({
              babyId: babyDoc._id,
              name: update.name,
              dueDate: update.dueDate,
              theme: update.theme,
              laborStarted: update.laborStarted,
              wentToHospital: update.wentToHospital,
              babyBorn: update.babyBorn,
              customMessage: update.customMessage,
              babyBornMessage: update.babyBornMessage,
            });
          }}
          isOpen={!!search.settings}
        />
      )}

      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Gradient Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="border-b border-border/50">
          {/* Nav content desktop */}
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
            <NavContent baby={babyDoc} isOwner={isOwner} />
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
