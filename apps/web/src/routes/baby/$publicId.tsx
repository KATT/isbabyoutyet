import { Card, CardContent, CardFooter } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import { BabyNav } from "@/components/baby/baby-nav";
import { EncouragementForm, EncouragementsFeed } from "@/components/baby/encouragements";
import { NotificationSubscribe } from "@/components/baby/notification-subscribe";
import { ProgressIndicator } from "@/components/baby/progress-indicator";
import { ScheduledNotificationToast } from "@/components/baby/scheduled-notification-toast";
import { SettingsPanel } from "@/components/baby/settings-panel";
import { StatusDisplay } from "@/components/baby/status-display";
import type { BabyData } from "@workspace/convex/src/types";
import { getCurrentStatus } from "@workspace/convex/src/types";
import {
  getDaysUntilDueDate,
  getOverdueDays,
  getThemeCssUrl,
  getThemePrimaryColor,
} from "@/components/baby/utils";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import type { Doc } from "@workspace/convex/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@workspace/convex/convex/_generated/api";

export const Route = createFileRoute("/baby/$publicId")({
  component: BabyPage,
  validateSearch: z.object({
    settings: z.boolean().optional(),
    beta: z.boolean().optional(),
  }),
  loader: async (opts) => {
    const [baby, vapidPublicKey] = await Promise.all([
      opts.context.convexClient.query(api.baby.getByPublicId, {
        id: opts.params.publicId,
      }),
      opts.context.convexClient.query(api.pushSubscriptions.getPublicKey, {}),
    ]);
    if (!baby) {
      throw notFound();
    }
    return {
      baby,
      vapidPublicKey,
    };
  },
  head: (opts) => {
    const baby = opts.loaderData?.baby;

    if (!baby) {
      return {};
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
    const manifestUrl = `/baby/manifest/${baby._id}`;

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
      links: [
        {
          rel: "manifest",
          href: manifestUrl,
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
    theme: doc.theme ?? null,
    laborStarted: doc.laborStarted ?? null,
    wentToHospital: doc.wentToHospital ?? null,
    babyBorn: doc.babyBorn ?? null,
    hospitalMessage: doc.hospitalMessage ?? null,
    babyBornMessage: doc.babyBornMessage ?? null,
    laborStartedMessage: doc.laborStartedMessage ?? null,
    encouragementsDisabled: doc.encouragementsDisabled,
    photoId: doc.photoId ?? null,
  };
}

function BabyPage() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const loaderData = Route.useLoaderData();
  // Use prefetched data if available, otherwise use reactive query
  const queryBaby = useQuery(api.baby.getByPublicId, { id: params.publicId });
  // Prefer query result (reactive) over prefetched data, but use prefetched as fallback
  const babyDoc = queryBaby ?? loaderData.baby;
  const baby = docToBabyData(babyDoc);
  const themeCssUrl = getThemeCssUrl(baby.theme);
  const sessionResult = authClient.useSession();
  const updateBaby = useMutation(api.baby.update);
  const photoUrl = useQuery(api.baby.getPhotoUrl, { photoId: babyDoc.photoId });

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
        <>
          <SettingsPanel
            baby={baby}
            babyId={babyDoc._id}
            photoUrl={photoUrl ?? null}
            onUpdate={async (update) => {
              await updateBaby({
                babyId: babyDoc._id,
                ...update,
              });
            }}
            isOpen={!!search.settings}
          />
          <ScheduledNotificationToast babyId={babyDoc._id} />
        </>
      )}

      <div className="min-h-screen bg-background relative">
        {/* Gradient Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="border-b border-border/50">
          <BabyNav
            shareLink={`https://isbabyoutyet.com/baby/${babyDoc.publicId}`}
            settingsButton={
              isOwner
                ? {
                    to: "/baby/$publicId",
                    params: { publicId: params.publicId },
                    search: {
                      ...search,
                      settings: search.settings ? undefined : true,
                    },
                  }
                : null
            }
            settingsOpen={!!search.settings}
          />
          <h1 className="text-4xl md:text-7xl font-black text-foreground tracking-tight py-6 md:py-10 px-6 text-center">
            <span className="bg-linear-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
              Is {baby.name} out yet?
            </span>
          </h1>
        </div>
        <section className="relative px-6 py-12 text-center overflow-hidden">
          <div className="relative max-w-5xl mx-auto">
            <Card>
              <CardContent>
                <StatusDisplay baby={baby} currentStatus={currentStatus} photoUrl={photoUrl} />
                <NotificationSubscribe
                  babyId={babyDoc._id}
                  vapidPublicKey={loaderData.vapidPublicKey}
                />
                <Separator className="my-4" />
              </CardContent>
              <CardFooter>
                <ProgressIndicator baby={baby} currentStatus={currentStatus} />
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* Encouragements Section */}
        {!baby.encouragementsDisabled && (
          <section className="relative px-6 pb-12">
            <div className="relative max-w-2xl mx-auto space-y-8">
              <Card>
                <CardContent className="pt-6">
                  <EncouragementForm babyId={babyDoc._id} babyName={baby.name} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <EncouragementsFeed babyId={babyDoc._id} isOwner={isOwner} />
                </CardContent>
              </Card>
            </div>
          </section>
        )}

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
