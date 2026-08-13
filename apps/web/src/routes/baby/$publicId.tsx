import { Dialog, DialogContent, DialogTitle } from "@workspace/ui/components/dialog";
import { BabyNav } from "@/components/baby/baby-nav";
import { Baby } from "@phosphor-icons/react";
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
import {
  createFileRoute,
  Link,
  notFound,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { z } from "zod";
import type { Doc } from "@workspace/convex/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@workspace/convex/convex/_generated/api";
import { translate, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/baby/$publicId")({
  component: BabyPage,
  validateSearch: z.object({
    settings: z.boolean().optional(),
    beta: z.boolean().optional(),
  }),
  beforeLoad: async (opts) => {
    const baby = await opts.context.convexClient.query(api.baby.getByPublicId, {
      id: opts.params.publicId,
    });
    if (!baby) {
      throw notFound();
    }
    if (baby.publicId !== opts.params.publicId) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: baby.publicId },
        search: opts.location.search,
        replace: true,
      });
    }
    return { baby, locale: baby.resolvedLocale };
  },
  loader: async (opts) => {
    const baby = opts.context.baby;
    const vapidPublicKey = await opts.context.convexClient.query(
      api.pushSubscriptions.getPublicKey,
      {},
    );
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

    const locale = baby.resolvedLocale;
    let title = translate(locale, "Is {{name}} out yet?", { name: baby.name });
    if (!isBorn) {
      if (overdueDays > 0) {
        title = translate(
          locale,
          overdueDays === 1
            ? "{{count}} day overdue – Is {{name}} out yet?"
            : "{{count}} days overdue – Is {{name}} out yet?",
          { count: overdueDays, name: baby.name },
        );
      } else {
        title = translate(
          locale,
          daysUntilDueDate === 1
            ? "{{count}} day until due date – Is {{name}} out yet?"
            : "{{count}} days until due date – Is {{name}} out yet?",
          { count: daysUntilDueDate, name: baby.name },
        );
      }
    }
    title = translate(locale, "{{title}} – Track Your Baby's Journey", { title });

    const description = translate(locale, "Track {{name}}'s journey – know when baby arrives!", {
      name: baby.name,
    });

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
          property: "og:title",
          content: title,
        },
        {
          property: "og:description",
          content: description,
        },
        {
          property: "og:url",
          content: `https://isbabyoutyet.com/baby/${baby.publicId}`,
        },
        {
          property: "og:locale",
          content: locale.replace("-", "_"),
        },
        {
          name: "twitter:title",
          content: title,
        },
        {
          name: "twitter:description",
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
        {
          rel: "canonical",
          href: `https://isbabyoutyet.com/baby/${baby.publicId}`,
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
    locale: doc.locale ?? null,
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
  const { t } = useI18n();
  const params = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const loaderData = Route.useLoaderData();
  // Use prefetched data if available, otherwise use reactive query
  const queryBaby = useQuery(api.baby.getByPublicId, { id: params.publicId });
  // Prefer query result (reactive) over prefetched data, but use prefetched as fallback
  const babyDoc = queryBaby ?? loaderData.baby;
  const baby = docToBabyData(babyDoc);
  const themeCssUrl = getThemeCssUrl(baby.theme);
  const sessionResult = authClient.useSession();
  const updateBaby = useMutation(api.baby.update);
  const removeBaby = useMutation(api.baby.remove);
  const claimInvites = useMutation(api.coParents.claimPendingInvites);
  const [composerOpen, setComposerOpen] = useState(false);
  const latestUpdateQuery = useQuery(api.timeline.latestUpdate, { babyId: babyDoc._id });
  const profile = useQuery(api.profile.get, {});
  const myAccess = useQuery(api.coParents.myAccess, { babyId: babyDoc._id });
  // Prefer the reactive value; fall back to the loader's prefetch while loading
  const latestUpdate =
    latestUpdateQuery === undefined ? loaderData.latestUpdate : latestUpdateQuery;

  // Prefer server access (includes co-parents); fall back to session owner check
  // while the query loads so owners don't flash without controls.
  const isOwner = myAccess?.isOwner ?? sessionResult.data?.user?.id === babyDoc.userId;
  const canManage = myAccess?.canManage ?? isOwner;

  // Claim pending email invites when a signed-in user lands on a baby page
  useEffect(() => {
    if (!sessionResult.data?.user) return;
    void claimInvites({});
  }, [sessionResult.data?.user, claimInvites]);

  const currentStatus = getCurrentStatus(baby);

  return (
    <div className="min-h-screen bg-background bg-dots">
      {themeCssUrl && <link rel="stylesheet" href={themeCssUrl} />}

      {canManage && (
        <>
          <SettingsPanel
            baby={baby}
            profileLocale={profile?.locale}
            onUpdate={async (update) => {
              await updateBaby({
                babyId: babyDoc._id,
                ...update,
              });
              await router.invalidate();
            }}
            onDelete={
              isOwner
                ? async () => {
                    await removeBaby({ babyId: babyDoc._id });
                    void navigate({ to: "/dashboard" });
                  }
                : undefined
            }
            coParents={{ babyId: babyDoc._id, isOwner }}
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
          <ScheduledNotificationToast babyId={babyDoc._id} />
          <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogTitle className="sr-only">{t("Post an update")}</DialogTitle>
              <UpdateComposer
                babyId={babyDoc._id}
                baby={baby}
                babyName={baby.name}
                onPosted={() => setComposerOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Floating chrome: brand pill left, action dock right */}
      <header className="sticky top-0 z-20 px-4 pt-3 pb-1">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-full border-2 border-border bg-background/85 py-1.5 pl-2 pr-4 backdrop-blur-md shadow-sm transition-transform hover:-rotate-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
              <Baby className="h-4 w-4 text-primary" />
            </span>
            <span className="text-sm font-extrabold tracking-tight">isbabyoutyet</span>
          </Link>
          <BabyNav
            shareLink={`https://isbabyoutyet.com/baby/${babyDoc.publicId}`}
            onPostUpdate={canManage ? () => setComposerOpen(true) : null}
            settingsButton={
              canManage
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
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16">
        <h1 className="px-2 pt-10 pb-10 text-center text-4xl font-black tracking-tight text-foreground text-balance md:pt-14 md:text-6xl">
          {t("Is {{name}} out yet?", { name: baby.name })}
        </h1>

        {/* Split layout: sticky status card on the left, feed on the right */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
          <section className="rounded-[2rem] border-2 border-border bg-card px-6 pb-8 text-center pop-shadow-strong md:px-8 lg:sticky lg:top-20">
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
            <div className="flex justify-center">
              <NotificationSubscribe
                babyId={babyDoc._id}
                vapidPublicKey={loaderData.vapidPublicKey}
              />
            </div>
            <div className="my-8 border-t-2 border-dashed border-border" aria-hidden="true" />
            <ProgressIndicator baby={baby} currentStatus={currentStatus} />
          </section>

          {/* Timeline: owner updates interleaved with encouragements. The
              feed comes before the visitor's encouragement form; the owner
              posts via the "Post update" button in the dock. */}
          <div className="space-y-8">
            <section className="rounded-[2rem] border-2 border-border bg-card p-6 pop-shadow md:p-8">
              <TimelineFeed
                babyId={babyDoc._id}
                baby={baby}
                babyName={baby.name}
                isOwner={canManage}
              />
            </section>

            {!baby.encouragementsDisabled && (
              <section className="rounded-[2rem] border-2 border-secondary/60 bg-secondary/15 p-6 pop-shadow md:p-8">
                <EncouragementForm babyId={babyDoc._id} babyName={baby.name} />
              </section>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t-2 border-border/60 bg-background/60 py-8 text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-1 px-6 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("Having a baby? Are people messaging you non-stop? Create your own page →")}
        </Link>
      </footer>
    </div>
  );
}
