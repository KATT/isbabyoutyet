import { Dialog, DialogContent, DialogTitle } from "@workspace/ui/components/dialog";
import { BabyNav } from "@/components/baby/baby-nav";
import { Baby } from "@phosphor-icons/react";
import { EncouragementForm } from "@/components/baby/encouragements";
import { TimelineFeed, UpdateComposer } from "@/components/baby/timeline";
import { NotificationSubscribe } from "@/components/baby/notification-subscribe";
import { ProgressIndicator } from "@/components/baby/progress-indicator";
import { ScheduledNotificationToast } from "@/components/baby/scheduled-notification-toast";
import { HomepageDemoToast } from "@/components/baby/homepage-demo-toast";
import { SettingsPanel } from "@/components/baby/settings-panel";
import { StatusDisplay } from "@/components/baby/status-display";
import { OnboardingHost, useCompleteOnboardingStep } from "@/components/onboarding/onboarding-host";
import type { BabyData } from "@workspace/convex/src/types";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import { getCurrentStatus } from "@workspace/convex/src/types";
import { getThemeCss } from "@/components/baby/utils";
import { authClient } from "@/lib/auth-client";
import {
  createFileRoute,
  Link,
  notFound,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { allKeyed } from "@workspace/query-prefetch";
import {
  getConvexQueryPreloader,
  useInitiateConvexQuery,
  usePreloadedConvexQuery,
} from "@workspace/convex-prefetch";
import { z } from "zod";
import type { FunctionReturnType } from "convex/server";
import { useMutation } from "convex/react";
import { Suspense, useEffect, useState } from "react";
import { api } from "@workspace/convex/convex/_generated/api";
import { babySeoHead, openGraphImageMeta } from "@/lib/seo";
import { babyPageRobotsHeaders, searchRobotsMeta } from "@/lib/robots";
import { useI18n } from "@/lib/i18n";
import { canonicalUrl } from "@/lib/site-url";

const TIMELINE_PAGE_SIZE = 20;

export const Route = createFileRoute("/baby/$publicId")({
  component: BabyPage,
  validateSearch: z.object({
    settings: z.boolean().optional(),
    beta: z.boolean().optional(),
  }),
  beforeLoad: async (opts) => {
    const preloader = getConvexQueryPreloader(opts.context.queryClient);
    const baby = await preloader.ensureQueryData(api.baby.getByPublicId, {
      id: opts.params.publicId,
    });
    const babyDoc = baby.initialData;
    if (!babyDoc) {
      throw notFound();
    }
    if (babyDoc.publicId !== opts.params.publicId) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: babyDoc.publicId },
        search: opts.location.search,
        replace: true,
      });
    }
    return { locale: babyDoc.resolvedLocale };
  },
  loader: async (opts) => {
    const preloader = getConvexQueryPreloader(opts.context.queryClient);
    const babyHandle = await preloader.ensureQueryData(api.baby.getByPublicId, {
      id: opts.params.publicId,
    });
    const babyDoc = babyHandle.initialData;
    if (!babyDoc) {
      throw notFound();
    }

    const shared = await allKeyed({
      myAccess: preloader.ensureQueryData(api.coParents.myAccess, { babyId: babyDoc._id }),
      vapidPublicKey: preloader.ensureQueryData(api.pushSubscriptions.getPublicKey, {}),
      latestUpdate: preloader.ensureQueryData(api.timeline.latestUpdate, { babyId: babyDoc._id }),
      timeline: preloader.ensureInfiniteQueryData(api.timeline.listByBaby, {
        args: { babyId: babyDoc._id },
        numItems: TIMELINE_PAGE_SIZE,
      }),
      profile: preloader.ensureQueryData(api.profile.get, {}),
    });

    return {
      baby: babyHandle,
      ...shared,
    };
  },
  head: (opts) => {
    const babyDoc = opts.loaderData?.baby.initialData;

    if (!babyDoc) {
      return {};
    }

    const seo = babySeoHead({
      name: babyDoc.name,
      dueDate: babyDoc.dueDate,
      publicId: babyDoc.publicId,
      theme: babyDoc.theme,
      locale: babyDoc.resolvedLocale,
      babyBorn: babyDoc.babyBorn,
      wentToHospital: babyDoc.wentToHospital,
      laborStarted: babyDoc.laborStarted,
    });
    // Inline via `styles` (not `links`): TanStack Asset forces React 19
    // `precedence` on stylesheet links, which can leave theme CSS stuck after
    // navigating away. Inline head styles still paint before body (no FOUC)
    // and unmount cleanly with the route.
    const themeCss = getThemeCss(babyDoc.theme);
    const manifestUrl = `/baby/manifest/${babyDoc._id}`;

    return {
      meta: [
        {
          title: seo.title,
        },
        {
          name: "description",
          content: seo.description,
        },
        {
          property: "og:title",
          content: seo.title,
        },
        {
          property: "og:description",
          content: seo.description,
        },
        {
          property: "og:url",
          content: seo.ogUrl,
        },
        {
          property: "og:locale",
          content: seo.locale.replace("-", "_"),
        },
        {
          property: "og:type",
          content: "website",
        },
        ...openGraphImageMeta({ imageUrl: seo.imageUrl, alt: seo.imageAlt }),
        {
          name: "twitter:title",
          content: seo.title,
        },
        {
          name: "twitter:description",
          content: seo.description,
        },
        {
          name: "theme-color",
          content: seo.themeColor,
        },
        ...searchRobotsMeta({ index: seo.indexable }),
      ],
      styles: themeCss
        ? [
            {
              "data-baby-theme": babyDoc.theme ?? "",
              children: themeCss,
            },
          ]
        : [],
      links: [
        {
          rel: "manifest",
          href: manifestUrl,
        },
        {
          rel: "canonical",
          href: seo.canonical,
        },
      ],
    };
  },
  headers: (opts) => babyPageRobotsHeaders(opts.params.publicId),
});

/**
 * Convert Convex Doc to BabyData for use with shared components
 */
function docToBabyData(
  doc: NonNullable<FunctionReturnType<typeof api.baby.getByPublicId>>,
): BabyData {
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

type BabyManagerControlsProps = {
  baby: BabyData;
  babyDoc: NonNullable<FunctionReturnType<typeof api.baby.getByPublicId>>;
  profileLocale: SupportedLocale;
  isOwner: boolean;
  composerOpen: boolean;
  onComposerOpenChange: (open: boolean) => void;
};

function BabyManagerControls(props: BabyManagerControlsProps) {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const updateBaby = useMutation(api.baby.update);
  const removeBaby = useMutation(api.baby.remove);
  const completeOnboardingStep = useCompleteOnboardingStep();

  const scheduledNotifications = useInitiateConvexQuery(api.baby.getScheduledNotifications, {
    babyId: props.babyDoc._id,
  });
  const subscriptionCount = useInitiateConvexQuery(api.pushSubscriptions.getSubscriptionCount, {
    babyId: props.babyDoc._id,
  });
  const onboarding = useInitiateConvexQuery(api.onboarding.getMine, {});
  const coParentsList = useInitiateConvexQuery(api.coParents.listForBaby, {
    babyId: props.babyDoc._id,
  });

  return (
    <>
      <OnboardingHost
        surface="baby"
        onboarding={onboarding}
        enabled={undefined}
        babyPublicId={props.babyDoc.publicId}
        spotlight={!search.settings && !props.composerOpen}
        onGoToStep={(stepId) => {
          if (stepId === "post_update") {
            props.onComposerOpenChange(true);
            return;
          }
          if (stepId === "explore_settings") {
            void navigate({
              search: {
                ...search,
                settings: true,
              },
              replace: true,
            });
          }
        }}
      />
      <SettingsPanel
        baby={props.baby}
        profileLocale={props.profileLocale}
        onUpdate={async (update) => {
          await updateBaby({
            babyId: props.babyDoc._id,
            ...update,
          });
          await router.invalidate();
        }}
        onDelete={
          props.isOwner
            ? async () => {
                await removeBaby({ babyId: props.babyDoc._id });
                void navigate({ to: "/dashboard" });
              }
            : null
        }
        coParents={{
          babyId: props.babyDoc._id,
          isOwner: props.isOwner,
          listing: coParentsList,
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
      <ScheduledNotificationToast
        notifications={scheduledNotifications}
        subscriptionCount={subscriptionCount}
      />
      <Dialog open={props.composerOpen} onOpenChange={props.onComposerOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle className="sr-only">{t("Post an update")}</DialogTitle>
          <UpdateComposer
            babyId={props.babyDoc._id}
            baby={props.baby}
            babyName={props.baby.name}
            onPosted={() => {
              props.onComposerOpenChange(false);
              void completeOnboardingStep({ stepId: "post_update" });
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function BabyPage() {
  const { t, locale } = useI18n();
  const params = Route.useParams();
  const search = Route.useSearch();
  const loaderData = Route.useLoaderData();
  if (!loaderData) {
    throw notFound();
  }

  const babyQuery = usePreloadedConvexQuery(api.baby.getByPublicId, loaderData.baby);
  const babyDoc = babyQuery.data;
  if (!babyDoc) {
    throw notFound();
  }
  const baby = docToBabyData(babyDoc);

  const latestUpdateQuery = usePreloadedConvexQuery(
    api.timeline.latestUpdate,
    loaderData.latestUpdate,
  );
  const profileQuery = usePreloadedConvexQuery(api.profile.get, loaderData.profile);
  const myAccessQuery = usePreloadedConvexQuery(api.coParents.myAccess, loaderData.myAccess);
  const vapidQuery = usePreloadedConvexQuery(
    api.pushSubscriptions.getPublicKey,
    loaderData.vapidPublicKey,
  );

  const sessionResult = authClient.useSession();
  const claimInvites = useMutation(api.coParents.claimPendingInvites);
  const completeOnboardingStep = useCompleteOnboardingStep();
  const [composerOpen, setComposerOpen] = useState(false);

  const latestUpdate = latestUpdateQuery.data;
  const profile = profileQuery.data;
  const myAccess = myAccessQuery.data;
  const isOwner = myAccess.isOwner;
  const canManage = myAccess.canManage;

  // Claim pending email invites when a signed-in user lands on a baby page
  useEffect(() => {
    if (!sessionResult.data?.user) return;
    void claimInvites({});
  }, [sessionResult.data?.user, claimInvites]);

  const currentStatus = getCurrentStatus(baby);

  return (
    <div className="min-h-screen bg-background bg-dots">
      <HomepageDemoToast publicId={babyDoc.publicId} />

      {canManage ? (
        <Suspense fallback={null}>
          <BabyManagerControls
            baby={baby}
            babyDoc={babyDoc}
            profileLocale={profile?.locale ?? locale}
            isOwner={isOwner}
            composerOpen={composerOpen}
            onComposerOpenChange={setComposerOpen}
          />
        </Suspense>
      ) : null}

      {/* Page chrome: brand pill left, action dock right. Scrolls with the page. */}
      <header className="px-4 pt-3 pb-1">
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
            shareLink={canonicalUrl(`/baby/${babyDoc.publicId}`)}
            onShareCopied={
              canManage
                ? () => {
                    void completeOnboardingStep({ stepId: "share_link" });
                  }
                : null
            }
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
            onSettingsOpened={
              canManage
                ? () => {
                    void completeOnboardingStep({ stepId: "explore_settings" });
                  }
                : null
            }
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16">
        <h1 className="px-2 pt-10 pb-10 text-center text-4xl font-black tracking-tight text-foreground text-balance md:pt-14 md:text-6xl">
          {t("Is {{name}} out yet?", { name: baby.name })}
        </h1>

        {/* Split layout: sticky status card on the left, feed on the right.
            No internal scroll on the card — that steals wheel/trackpad from the page. */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
          <section className="overflow-x-clip rounded-[2rem] border-2 border-border bg-card px-5 pb-6 text-center pop-shadow-strong md:px-7 lg:sticky lg:top-4">
            <StatusDisplay
              baby={baby}
              currentStatus={currentStatus}
              photoUrl={babyDoc.photoUrl}
              thumbnailUrl={babyDoc.thumbnailUrl}
              latestUpdate={
                latestUpdate
                  ? {
                      message: latestUpdate.update.message ?? null,
                      postedAt: latestUpdate.postedAt,
                    }
                  : null
              }
            />
            <div className="flex justify-center">
              <NotificationSubscribe babyId={babyDoc._id} vapidPublicKey={vapidQuery.data} />
            </div>
            <div className="mt-4">
              <ProgressIndicator baby={baby} currentStatus={currentStatus} />
            </div>
          </section>

          {/* Timeline: owner updates interleaved with encouragements. The
              visitor's encouragement form sits above the feed so nobody has
              to scroll past every message to post; the owner posts via the
              "Post update" button in the dock. */}
          <div className="space-y-8">
            {!baby.encouragementsDisabled && (
              <section
                className="rounded-[2rem] border-2 border-secondary/60 bg-secondary/15 p-6 pop-shadow md:p-8"
                data-tour-id="learn_encouragements"
              >
                <EncouragementForm babyId={babyDoc._id} babyName={baby.name} />
              </section>
            )}

            <section className="rounded-[2rem] border-2 border-border bg-card p-6 pop-shadow md:p-8">
              <TimelineFeed
                babyId={babyDoc._id}
                baby={baby}
                babyName={baby.name}
                isOwner={canManage}
                timeline={loaderData.timeline}
              />
            </section>
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
