import { Card, CardContent, CardFooter } from "@workspace/ui/components/card";
import { Dialog, DialogContent, DialogTitle } from "@workspace/ui/components/dialog";
import { Separator } from "@workspace/ui/components/separator";
import { BabyNav } from "@/components/baby/baby-nav";
import { EncouragementForm } from "@/components/baby/encouragements";
import { TimelineFeed, UpdateComposer } from "@/components/baby/timeline";
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
import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import type { Doc } from "@workspace/convex/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "@workspace/convex/convex/_generated/api";

export const Route = createFileRoute("/baby/$publicId")({
  component: BabyPage,
  validateSearch: z.object({
    settings: z.boolean().optional(),
    postUpdate: z.boolean().optional(),
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
    // Redirect if baby found but current publicId doesn't match (server-side check)
    if (baby.publicId !== opts.params.publicId) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: baby.publicId },
        search: opts.location.search,
        replace: true,
      });
    }
    // Prefetch so the status card doesn't flash without its message
    const latestUpdate = await opts.context.convexClient.query(api.timeline.latestUpdate, {
      babyId: baby._id,
    });
    return {
      baby,
      vapidPublicKey,
      latestUpdate,
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
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const loaderData = Route.useLoaderData();
  // Use prefetched data if available, otherwise use reactive query
  const queryBaby = useQuery(api.baby.getByPublicId, { id: params.publicId });
  // Prefer query result (reactive) over prefetched data, but use prefetched as fallback
  const babyDoc = queryBaby ?? loaderData.baby;
  const baby = docToBabyData(babyDoc);
  const themeCssUrl = getThemeCssUrl(baby.theme);
  const sessionResult = authClient.useSession();
  const updateBaby = useMutation(api.baby.update);
  const latestUpdateQuery = useQuery(api.timeline.latestUpdate, { babyId: babyDoc._id });
  // Prefer the reactive value; fall back to the loader's prefetch while loading
  const latestUpdate =
    latestUpdateQuery === undefined ? loaderData.latestUpdate : latestUpdateQuery;

  // Better-auth user ID is in session.user.id, but Convex uses identity.subject which is the same
  const isOwner = sessionResult.data?.user?.id === babyDoc.userId;

  const currentStatus = getCurrentStatus(baby);

  function setSearchOpen(opts: { settings?: boolean; postUpdate?: boolean }) {
    void navigate({
      search: {
        ...search,
        settings: opts.settings || undefined,
        postUpdate: opts.postUpdate || undefined,
      },
      replace: true,
    });
  }

  return (
    <div>
      {themeCssUrl && <link rel="stylesheet" href={themeCssUrl} />}

      {isOwner && (
        <>
          <SettingsPanel
            baby={baby}
            onUpdate={async (update) => {
              await updateBaby({
                babyId: babyDoc._id,
                ...update,
              });
            }}
            open={!!search.settings}
            onOpenChange={(open) => {
              setSearchOpen({ settings: open, postUpdate: false });
            }}
          />
          <ScheduledNotificationToast babyId={babyDoc._id} />
          <Dialog
            open={!!search.postUpdate}
            onOpenChange={(open) => {
              setSearchOpen({ postUpdate: open, settings: false });
            }}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogTitle className="sr-only">Post an update</DialogTitle>
              <UpdateComposer
                babyId={babyDoc._id}
                baby={baby}
                babyName={baby.name}
                onPosted={() => setSearchOpen({ postUpdate: false, settings: false })}
              />
            </DialogContent>
          </Dialog>
        </>
      )}

      <div className="border-b border-border/50">
        <BabyNav
          shareLink={`https://isbabyoutyet.com/baby/${babyDoc.publicId}`}
          postUpdateButton={
            isOwner
              ? {
                  to: "/baby/$publicId",
                  params: { publicId: params.publicId },
                  search: {
                    ...search,
                    postUpdate: search.postUpdate ? undefined : true,
                    settings: undefined,
                  },
                }
              : null
          }
          postUpdateOpen={!!search.postUpdate}
          settingsButton={
            isOwner
              ? {
                  to: "/baby/$publicId",
                  params: { publicId: params.publicId },
                  search: {
                    ...search,
                    settings: search.settings ? undefined : true,
                    postUpdate: undefined,
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
              <StatusDisplay
                baby={baby}
                currentStatus={currentStatus}
                photoUrl={babyDoc.photoUrl}
                thumbnailUrl={babyDoc.thumbnailUrl}
                latestUpdate={
                  latestUpdate
                    ? { message: latestUpdate.update.message, postedAt: latestUpdate.postedAt }
                    : null
                }
              />
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

      {/* Timeline Section: owner updates interleaved with encouragements.
          The news (feed) comes before the visitor's encouragement form; the
          owner posts via the "Post update" button in the fixed nav bar. */}
      <section className="relative px-6 pb-12">
        <div className="relative max-w-2xl mx-auto space-y-8">
          <Card>
            <CardContent className="pt-6">
              <TimelineFeed
                babyId={babyDoc._id}
                baby={baby}
                babyName={baby.name}
                isOwner={isOwner}
              />
            </CardContent>
          </Card>

          {!baby.encouragementsDisabled && (
            <Card>
              <CardContent className="pt-6">
                <EncouragementForm babyId={babyDoc._id} babyName={baby.name} />
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Footer: extra bottom padding on mobile clears the fixed bottom bar */}
      <div className="text-center pt-8 pb-28 md:pb-8 border-t border-border/50">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Having a baby? Are people messaging you non-stop? Create your own page →
        </Link>
      </div>
    </div>
  );
}
