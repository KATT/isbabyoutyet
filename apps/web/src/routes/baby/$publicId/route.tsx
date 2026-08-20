import { Dialog, DialogContent, DialogTitle } from "@workspace/ui/components/dialog";
import { BabyNav } from "@/components/baby/baby-nav";
import { Baby } from "@phosphor-icons/react";
import { EncouragementForm } from "@/components/baby/encouragements";
import { TimelineFeed, UpdateComposer } from "@/components/baby/timeline";
import { NotificationSubscribe } from "@/components/baby/notification-subscribe";
import { ProgressIndicator } from "@/components/baby/progress-indicator";
import { ScheduledNotificationToast } from "@/components/baby/scheduled-notification-toast";
import { HomepageDemoToast } from "@/components/baby/homepage-demo-toast";
import { StatusDisplay } from "@/components/baby/status-display";
import { OnboardingHost, useCompleteOnboardingStep } from "@/components/onboarding/onboarding-host";
import { FORBIDDEN, getCurrentStatus } from "@workspace/convex/src/types";
import { getThemeCss } from "@/components/baby/utils";
import {
  createFileRoute,
  Link,
  notFound,
  Outlet,
  redirect,
  useMatchRoute,
  useNavigate,
} from "@tanstack/react-router";
import { allKeyed } from "@workspace/query-prefetch";
import { getConvexQueryPreloader, usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useState } from "react";
import { api } from "@workspace/convex/convex/_generated/api";
import { babySeoHead, openGraphImageMeta } from "@/lib/seo";
import { babyPageRobotsHeaders, searchRobotsMeta } from "@/lib/robots";
import { useI18n } from "@/lib/i18n";
import { preserveScroll } from "@/lib/scroll-restoration";
import { canonicalUrl } from "@/lib/site-url";
import { authServer } from "@/lib/auth-server";
import { babySearchWithoutSettings, docToBabyData, TIMELINE_PAGE_SIZE } from "./shared";

const getAuthToken = createServerFn({ method: "GET" }).handler(async () => {
  return await authServer.getToken();
});

export const Route = createFileRoute("/baby/$publicId")({
  component: BabyPageLayout,
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

    const search = opts.location.search as {
      settings: boolean | undefined;
      beta: boolean | undefined;
    };

    if (search.settings === true) {
      throw redirect({
        to: "/baby/$publicId/settings",
        params: { publicId: babyDoc.publicId },
        search: babySearchWithoutSettings(search),
        replace: true,
      });
    }

    if (babyDoc.publicId !== opts.params.publicId) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: babyDoc.publicId },
        search: babySearchWithoutSettings(search),
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

    const profileHandle = await preloader.ensureQueryData(api.profile.get, {});
    const token =
      opts.context.token ?? (profileHandle.initialData != null ? await getAuthToken() : null);
    if (token) {
      opts.context.convexClient.setAuth(async () => token);
      await opts.context.convexClient.mutation(api.profile.ensure, {
        browserLocale: opts.context.locale,
      });
    }

    return {
      baby: babyHandle,
      ...(await allKeyed({
        myAccess: preloader.ensureQueryData(api.coParents.myAccess, { babyId: babyDoc._id }),
        vapidPublicKey: preloader.ensureQueryData(api.pushSubscriptions.getPublicKey, {}),
        latestUpdate: preloader.ensureQueryData(api.timeline.latestUpdate, {
          babyId: babyDoc._id,
        }),
        timeline: preloader.ensureInfiniteQueryData(api.timeline.listByBaby, {
          args: { babyId: babyDoc._id },
          numItems: TIMELINE_PAGE_SIZE,
        }),
        managerBaby: preloader.ensureQueryData(api.baby.getManagerBaby, {
          babyId: babyDoc._id,
        }),
        scheduledNotifications: preloader.ensureQueryData(api.baby.getScheduledNotifications, {
          babyId: babyDoc._id,
        }),
        subscriptionCount: preloader.ensureQueryData(api.pushSubscriptions.getSubscriptionCount, {
          babyId: babyDoc._id,
        }),
        onboarding: preloader.ensureQueryData(api.onboarding.getMine, {}),
      })),
    };
  },
  head: (opts) => {
    const babyDoc = opts.loaderData?.baby.initialData;

    if (!babyDoc) {
      return {};
    }

    const seo = babySeoHead({
      name: babyDoc.name,
      ...(babyDoc.dueDateDisplayMode === "exact"
        ? { dueDateDisplayMode: "exact" as const, dueDate: babyDoc.dueDate }
        : {
            dueDateDisplayMode: "message" as const,
            publicDueDateText: babyDoc.publicDueDateText,
          }),
      publicId: babyDoc.publicId,
      theme: babyDoc.theme,
      locale: babyDoc.resolvedLocale,
      babyBorn: babyDoc.babyBorn,
      wentToHospital: babyDoc.wentToHospital,
      laborStarted: babyDoc.laborStarted,
      milestoneVisibility: babyDoc.milestoneVisibility,
    });
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

function BabyPageLayout() {
  const { t } = useI18n();
  const params = Route.useParams();
  const navigate = useNavigate({ from: "/baby/$publicId" });
  const loaderData = Route.useLoaderData();
  const matchRoute = useMatchRoute();
  const settingsOpen = !!matchRoute({ to: "/baby/$publicId/settings" });
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
  const myAccessQuery = usePreloadedConvexQuery(api.coParents.myAccess, loaderData.myAccess);
  const vapidQuery = usePreloadedConvexQuery(
    api.pushSubscriptions.getPublicKey,
    loaderData.vapidPublicKey,
  );
  const managerBabyQuery = usePreloadedConvexQuery(api.baby.getManagerBaby, loaderData.managerBaby);

  const completeOnboardingStep = useCompleteOnboardingStep();
  const [composerOpen, setComposerOpen] = useState(false);

  const latestUpdate = latestUpdateQuery.data;
  const myAccess = myAccessQuery.data;
  const canManage = myAccess.canManage;
  const managerBabyDoc = managerBabyQuery.data === FORBIDDEN ? null : managerBabyQuery.data;
  const birthJourney = managerBabyDoc?.birthJourney ?? null;

  const currentStatus = getCurrentStatus(baby);

  return (
    <div className="min-h-screen bg-background bg-dots">
      <HomepageDemoToast publicId={babyDoc.publicId} />

      {canManage && birthJourney && managerBabyDoc ? (
        <OnboardingHost
          surface="baby"
          onboarding={loaderData.onboarding}
          enabled={undefined}
          babyPublicId={babyDoc.publicId}
          spotlight={!settingsOpen && !composerOpen}
          onGoToStep={(stepId) => {
            if (stepId === "post_update") {
              setComposerOpen(true);
              return;
            }
            if (stepId === "explore_settings") {
              void navigate({
                to: "/baby/$publicId/settings",
                params: { publicId: babyDoc.publicId },
                replace: true,
                ...preserveScroll,
              });
            }
          }}
        />
      ) : null}

      {canManage && birthJourney && managerBabyDoc ? (
        <>
          <ScheduledNotificationToast
            notifications={loaderData.scheduledNotifications}
            subscriptionCount={loaderData.subscriptionCount}
          />
          <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogTitle className="sr-only">{t("Post an update")}</DialogTitle>
              <UpdateComposer
                babyId={babyDoc._id}
                baby={baby}
                babyName={baby.name}
                onPosted={() => {
                  setComposerOpen(false);
                  void completeOnboardingStep({ stepId: "post_update" });
                }}
              />
            </DialogContent>
          </Dialog>
        </>
      ) : null}

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
                ? settingsOpen
                  ? {
                      to: "/baby/$publicId",
                      params: { publicId: params.publicId },
                      replace: true,
                      ...preserveScroll,
                    }
                  : {
                      to: "/baby/$publicId/settings",
                      params: { publicId: params.publicId },
                      replace: true,
                      ...preserveScroll,
                    }
                : null
            }
            settingsOpen={settingsOpen}
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

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
          <section className="overflow-x-clip rounded-[2rem] border-2 border-border bg-card px-5 pb-6 text-center pop-shadow-strong md:px-7 lg:sticky lg:top-4">
            <StatusDisplay
              baby={baby}
              currentStatus={currentStatus}
              photoUrl={babyDoc.photoUrl}
              thumbnailUrl={babyDoc.thumbnailUrl}
              blurDataUrl={babyDoc.blurDataUrl ?? null}
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

          <div className="space-y-8">
            <section
              className="rounded-[2rem] border-2 border-secondary/60 bg-secondary/15 p-6 pop-shadow md:p-8"
              data-tour-id="learn_encouragements"
            >
              <EncouragementForm babyId={babyDoc._id} babyName={baby.name} />
            </section>

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

      <Outlet />
    </div>
  );
}
