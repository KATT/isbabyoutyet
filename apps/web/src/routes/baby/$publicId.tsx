import { Dialog, DialogContent, DialogTitle } from "@workspace/ui/components/dialog";
import { Separator } from "@workspace/ui/components/separator";
import { AppHeader } from "@/components/baby/app-header";
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
    <div className="min-h-screen bg-background">
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

      <AppHeader>
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
      </AppHeader>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Is {baby.name} out yet?
        </h1>

        {/* Two columns on desktop: sticky status panel + scrolling feed */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
          <section className="rounded-xl border border-border/70 bg-card p-5 md:p-6 lg:sticky lg:top-20">
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
            <div className="mt-5 [&_button]:w-full">
              <NotificationSubscribe
                babyId={babyDoc._id}
                vapidPublicKey={loaderData.vapidPublicKey}
              />
            </div>
            <Separator className="my-6" />
            <ProgressIndicator baby={baby} currentStatus={currentStatus} />
          </section>

          {/* Timeline: owner updates interleaved with encouragements. The
              feed comes before the visitor's encouragement form; the owner
              posts via the "Post update" button in the header. */}
          <div className="space-y-6">
            <section className="rounded-xl border border-border/70 bg-card p-5 md:p-6">
              <TimelineFeed babyId={babyDoc._id} babyName={baby.name} isOwner={isOwner} />
            </section>

            {!baby.encouragementsDisabled && (
              <section className="rounded-xl border border-border/70 bg-card p-5 md:p-6">
                <EncouragementForm babyId={babyDoc._id} babyName={baby.name} />
              </section>
            )}
          </div>
        </div>
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
  );
}
