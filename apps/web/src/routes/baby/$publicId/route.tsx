import { BabyNav } from "@/components/baby/baby-nav";
import { Baby } from "@phosphor-icons/react";
import { EncouragementForm } from "@/components/baby/encouragements";
import { TimelineFeed } from "@/components/baby/timeline";
import {
  NotificationSubscribe,
  prefetchBrowserPushCapability,
} from "@/components/baby/notification-subscribe";
import { ProgressIndicator } from "@/components/baby/progress-indicator";
import { ScheduledNotificationToast } from "@/components/baby/scheduled-notification-toast";
import { HomepageDemoToast } from "@/components/baby/homepage-demo-toast";
import { StatusDisplay } from "@/components/baby/status-display";
import { OnboardingHost, useCompleteOnboardingStep } from "@/components/onboarding/onboarding-host";
import type { BabyData } from "@workspace/convex/src/types";
import { FORBIDDEN, getCurrentStatus } from "@workspace/convex/src/types";
import { getThemeCss } from "@/components/baby/utils";
import {
  createFileRoute,
  Link,
  notFound,
  Outlet,
  redirect,
  useMatchRoute,
} from "@tanstack/react-router";
import { allKeyed } from "@workspace/query-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { z } from "zod";
import type { FunctionReturnType } from "convex/server";
import { api } from "@workspace/convex/convex/_generated/api";
import { openGraphImageMeta } from "@/lib/seo";
import { getBabySeo } from "@/lib/baby-seo";
import { babyRouteCacheHeaders } from "@/lib/cachePolicy";
import { babyPageRobotsHeaders, searchRobotsMeta } from "@/lib/robots";
import { useI18n } from "@/lib/i18n";
import { authClient } from "@/lib/auth-client";
import { BABY_FEED_HASH } from "@workspace/convex/src/babyFeedUrl";
import { useHashScroll } from "@/lib/use-hash-scroll";
import {
  useBabyLoginOverlayNav,
  useBabyPostOverlayNav,
  useBabySettingsOverlayNav,
  useBabyShareOverlayNav,
} from "@/lib/overlay-nav";

const TIMELINE_PAGE_SIZE = 20;

export const Route = createFileRoute("/baby/$publicId")({
  component: BabyPageLayout,
  validateSearch: z.object({
    settings: z.boolean().optional(),
    beta: z.boolean().optional(),
  }),
  beforeLoad: async (opts) => {
    const preloader = opts.context.convexPreloader;
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
    if (opts.search.settings) {
      throw redirect({
        to: "/baby/$publicId/settings",
        params: { publicId: babyDoc.publicId },
        replace: true,
      });
    }
    return { locale: babyDoc.resolvedLocale };
  },
  loader: async (opts) => {
    const preloader = opts.context.convexPreloader;
    const publicId = opts.params.publicId;
    const browserPush = prefetchBrowserPushCapability(opts.context.queryClient, publicId);

    const loaderData = await allKeyed({
      baby: preloader.ensureQueryData(api.baby.getByPublicId, {
        id: publicId,
      }),
      vapidPublicKey: preloader.ensureQueryData(api.pushSubscriptions.getPublicKey, {}),
      myAccess: preloader.ensureQueryData(api.coParents.myAccess, { babyId: publicId }),
      latestUpdate: preloader.ensureQueryData(api.timeline.latestUpdate, {
        babyId: publicId,
      }),
      timeline: preloader.ensureInfiniteQueryData(api.timeline.listByBaby, {
        args: { babyId: publicId },
        numItems: TIMELINE_PAGE_SIZE,
      }),
      managerBaby: preloader.ensureQueryData(api.baby.getManagerBaby, {
        babyId: publicId,
      }),
      scheduledNotifications: preloader.ensureQueryData(api.baby.getScheduledNotifications, {
        babyId: publicId,
      }),
      subscriptionCount: preloader.ensureQueryData(api.pushSubscriptions.getSubscriptionCount, {
        babyId: publicId,
      }),
      onboarding: preloader.ensureQueryData(api.onboarding.getMine, {}),
    });

    return {
      browserPush,
      ...loaderData,
    };
  },
  head: (opts) => {
    const babyDoc = opts.loaderData?.baby.initialData;

    if (!babyDoc) {
      return {};
    }

    const seo = getBabySeo(babyDoc, opts.params.publicId);
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
  headers: (opts) => ({
    ...babyRouteCacheHeaders({
      publicId: opts.params.publicId,
      routeIds: opts.matches.map((match) => match.routeId),
    }),
    ...babyPageRobotsHeaders(opts.params.publicId),
  }),
});

/**
 * Convert Convex Doc to BabyData for use with shared components
 */
export function docToBabyData(
  doc: NonNullable<FunctionReturnType<typeof api.baby.getByPublicId>>,
): BabyData {
  const common = {
    name: doc.name,
    theme: doc.theme ?? null,
    locale: doc.locale ?? null,
    timeZone: doc.timeZone,
    laborStarted: doc.laborStarted ?? null,
    wentToHospital: doc.wentToHospital ?? null,
    babyBorn: doc.babyBorn ?? null,
    milestoneVisibility: doc.milestoneVisibility,
    photoId: doc.photoId ?? null,
  };
  return doc.dueDateDisplayMode === "exact"
    ? {
        ...common,
        dueDate: doc.dueDate,
        dueDateDisplayMode: "exact",
        publicDueDateText: null,
      }
    : {
        ...common,
        dueDate: null,
        dueDateDisplayMode: "message",
        publicDueDateText: doc.publicDueDateText ?? null,
      };
}

type ManagerBabyDoc = Exclude<FunctionReturnType<typeof api.baby.getManagerBaby>, typeof FORBIDDEN>;

export function managerDocToBabyData(doc: ManagerBabyDoc): BabyData {
  return {
    name: doc.name,
    dueDate: doc.dueDate,
    dueDateDisplayMode: doc.dueDateDisplayMode,
    publicDueDateText: doc.publicDueDateText,
    theme: doc.theme ?? null,
    locale: doc.locale ?? null,
    timeZone: doc.timeZone,
    laborStarted: doc.laborStarted ?? null,
    wentToHospital: doc.wentToHospital ?? null,
    babyBorn: doc.babyBorn ?? null,
    milestoneVisibility: doc.milestoneVisibility,
    photoId: doc.photoId ?? null,
  };
}

function BabyPageLayout() {
  const { t } = useI18n();
  const params = Route.useParams();
  const matchRoute = useMatchRoute();
  const session = authClient.useSession();
  useHashScroll();
  const shareOpen = !!matchRoute({ to: "/baby/$publicId/share" });
  const settingsOpen = !!matchRoute({ to: "/baby/$publicId/settings" });
  const postUpdateOpen = !!matchRoute({ to: "/baby/$publicId/post" });
  const loginOpen = !!matchRoute({ to: "/baby/$publicId/login" });
  const photoOpen =
    !!matchRoute({ to: "/baby/$publicId/photo" }) ||
    !!matchRoute({ to: "/baby/$publicId/updates/$updateId/photo" });
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
  const managerBabyQuery = usePreloadedConvexQuery(api.baby.getManagerBaby, loaderData.managerBaby);
  const myAccessQuery = usePreloadedConvexQuery(api.coParents.myAccess, loaderData.myAccess);

  const completeOnboardingStep = useCompleteOnboardingStep();
  const share = useBabyShareOverlayNav(params.publicId);
  const post = useBabyPostOverlayNav(params.publicId);
  const settings = useBabySettingsOverlayNav(params.publicId);
  const login = useBabyLoginOverlayNav(params.publicId);

  const latestUpdate = latestUpdateQuery.data;
  const myAccess = myAccessQuery.data;
  const canManage = myAccess.canManage;
  const sessionPending = session.isPending;
  const signedIn = session.data !== null || canManage;
  const signInButton = signedIn || sessionPending ? null : login.openLink;
  const dashboardButton = signedIn ? { to: "/dashboard" as const } : null;
  const managerBabyDoc = managerBabyQuery.data === FORBIDDEN ? null : managerBabyQuery.data;
  const managerBaby = managerBabyDoc ? managerDocToBabyData(managerBabyDoc) : null;
  const birthJourney = managerBabyDoc?.birthJourney ?? null;

  const currentStatus = getCurrentStatus(baby);

  return (
    <div className="min-h-screen bg-background bg-dots">
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-auto max-w-sm flex-col gap-2 sm:inset-x-auto sm:right-4 sm:left-auto sm:mx-0">
        <HomepageDemoToast publicId={babyDoc.publicId} />
        {canManage && birthJourney && managerBaby ? (
          <ScheduledNotificationToast
            notifications={loaderData.scheduledNotifications}
            subscriptionCount={loaderData.subscriptionCount}
          />
        ) : null}
      </div>

      {canManage && birthJourney && managerBaby ? (
        <OnboardingHost
          surface="baby"
          onboarding={loaderData.onboarding}
          enabled={undefined}
          spotlight={!shareOpen && !postUpdateOpen && !settingsOpen && !photoOpen && !loginOpen}
        />
      ) : null}

      {/* Page chrome: brand pill left, action dock right. Scrolls with the page. */}
      <header className="px-4 pt-3 pb-1">
        <div className="mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-2">
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
            shareButton={share.openLink}
            shareOpen={shareOpen}
            onDismissShare={shareOpen ? share.dismiss : null}
            postUpdateButton={canManage ? post.openLink : null}
            postUpdateOpen={postUpdateOpen}
            onDismissPostUpdate={canManage && postUpdateOpen ? post.dismiss : null}
            settingsButton={canManage ? settings.openLink : null}
            settingsOpen={settingsOpen}
            onDismissSettings={canManage && settingsOpen ? settings.dismiss : null}
            onSettingsOpened={
              canManage
                ? () => {
                    void completeOnboardingStep({ stepId: "explore_settings" });
                  }
                : null
            }
            signInButton={signInButton}
            signInOpen={loginOpen}
            onDismissSignIn={loginOpen ? login.dismiss : null}
            dashboardButton={dashboardButton}
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
              publicId={babyDoc.publicId}
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
            <div className="flex flex-col items-center">
              <NotificationSubscribe
                babyId={babyDoc._id}
                vapidPublicKey={loaderData.vapidPublicKey}
                browserPush={loaderData.browserPush}
                audience={canManage ? "manager" : "visitor"}
              />
            </div>
            <div className="mt-4">
              <ProgressIndicator baby={baby} currentStatus={currentStatus} />
            </div>
          </section>

          {/* Timeline: owner updates interleaved with encouragements. The
              visitor's encouragement form sits above the feed so nobody has
              to scroll past every message to post; the owner posts via the
              "Post update" button in the dock. Notification clicks land on
              #feed — the messages list, not the compose box. */}
          <div className="space-y-8">
            <section
              className="rounded-[2rem] border-2 border-secondary/60 bg-secondary/15 p-6 pop-shadow md:p-8"
              data-tour-id="learn_encouragements"
            >
              <EncouragementForm babyId={babyDoc._id} babyName={baby.name} />
            </section>

            <section
              id={BABY_FEED_HASH}
              className="rounded-[2rem] border-2 border-border bg-card p-6 pop-shadow md:p-8"
            >
              <TimelineFeed
                babyId={babyDoc._id}
                publicId={babyDoc.publicId}
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
