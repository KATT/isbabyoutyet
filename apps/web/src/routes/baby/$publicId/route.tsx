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
import {
  useBabyPostOverlayNav,
  useBabySettingsOverlayNav,
  useBabyShareOverlayNav,
} from "@/lib/overlay-nav";
import * as stylex from "@stylexjs/stylex";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";

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

const styles = stylex.create({
  page: {
    backgroundColor: colors.background,
    backgroundImage: `radial-gradient(color-mix(in oklab, ${colors.border} 80%, transparent) 1.5px, transparent 1.5px)`,
    backgroundSize: "22px 22px",
    minHeight: "100vh",
  },
  header: {
    paddingBottom: spacing.s1,
    paddingInline: spacing.s4,
    paddingTop: spacing.s3,
  },
  headerInner: {
    alignItems: "center",
    display: "flex",
    gap: spacing.s2,
    justifyContent: "space-between",
    marginInline: "auto",
    maxWidth: "72rem",
  },
  brandChip: {
    alignItems: "center",
    backdropFilter: "blur(12px)",
    backgroundColor: `color-mix(in oklab, ${colors.background} 85%, transparent)`,
    borderColor: colors.border,
    borderRadius: "9999px",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    display: "flex",
    gap: spacing.s2,
    paddingBottom: spacing.s1_5,
    paddingLeft: spacing.s2,
    paddingRight: spacing.s4,
    paddingTop: spacing.s1_5,
    textDecoration: "none",
    transition: "transform 0.15s",
    ":hover": { transform: "rotate(-2deg)" },
  },
  brandIcon: {
    alignItems: "center",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    borderRadius: "9999px",
    color: colors.primary,
    display: "flex",
    height: "1.75rem",
    justifyContent: "center",
    width: "1.75rem",
  },
  brandName: {
    color: colors.foreground,
    fontSize: "0.875rem",
    fontWeight: 800,
    letterSpacing: "-0.025em",
  },
  main: {
    marginInline: "auto",
    maxWidth: "72rem",
    paddingBottom: spacing.s16,
    paddingInline: spacing.s4,
    width: "100%",
  },
  title: {
    color: colors.foreground,
    fontSize: {
      "@media (min-width: 768px)": "3.75rem",
      default: "2.25rem",
    },
    fontWeight: 900,
    letterSpacing: "-0.025em",
    margin: 0,
    paddingBottom: spacing.s10,
    paddingInline: spacing.s2,
    paddingTop: {
      "@media (min-width: 768px)": spacing.s16,
      default: spacing.s10,
    },
    textAlign: "center",
    textWrap: "balance",
  },
  layout: {
    display: "grid",
    gap: spacing.s8,
    gridTemplateColumns: {
      "@media (min-width: 1024px)": "minmax(0, 5fr) minmax(0, 6fr)",
      default: "1fr",
    },
    alignItems: {
      "@media (min-width: 1024px)": "start",
      default: "stretch",
    },
  },
  statusCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: "2rem",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: `6px 6px 0 0 color-mix(in oklab, ${colors.primary} 30%, transparent)`,
    overflowX: "clip",
    paddingBottom: spacing.s6,
    paddingInline: {
      "@media (min-width: 768px)": spacing.s8,
      default: spacing.s5,
    },
    position: {
      "@media (min-width: 1024px)": "sticky",
      default: "static",
    },
    textAlign: "center",
    top: {
      "@media (min-width: 1024px)": spacing.s4,
      default: "auto",
    },
  },
  centerRow: {
    display: "flex",
    justifyContent: "center",
  },
  progressWrap: {
    marginTop: spacing.s4,
  },
  feedColumn: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.s8,
  },
  encouragementCard: {
    backgroundColor: `color-mix(in oklab, ${colors.secondary} 15%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.secondary} 60%, transparent)`,
    borderRadius: "2rem",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: `4px 4px 0 0 color-mix(in oklab, ${colors.primary} 18%, transparent)`,
    padding: {
      "@media (min-width: 768px)": spacing.s8,
      default: spacing.s6,
    },
  },
  timelineCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: "2rem",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: `4px 4px 0 0 color-mix(in oklab, ${colors.primary} 18%, transparent)`,
    padding: {
      "@media (min-width: 768px)": spacing.s8,
      default: spacing.s6,
    },
  },
  footer: {
    backgroundColor: `color-mix(in oklab, ${colors.background} 60%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.border} 60%, transparent)`,
    borderStyle: "solid",
    borderTopWidth: "2px",
    paddingBlock: spacing.s8,
    textAlign: "center",
  },
  footerLink: {
    color: colors.mutedForeground,
    display: "inline-flex",
    fontSize: "0.875rem",
    fontWeight: 700,
    gap: spacing.s1,
    paddingInline: spacing.s6,
    textDecoration: "none",
    transition: "color 0.15s",
    ":hover": { color: colors.foreground },
  },
});

function BabyPageLayout() {
  const { t } = useI18n();
  const params = Route.useParams();
  const matchRoute = useMatchRoute();
  const shareOpen = !!matchRoute({ to: "/baby/$publicId/share" });
  const settingsOpen = !!matchRoute({ to: "/baby/$publicId/settings" });
  const postUpdateOpen = !!matchRoute({ to: "/baby/$publicId/post" });
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

  const latestUpdate = latestUpdateQuery.data;
  const myAccess = myAccessQuery.data;
  const canManage = myAccess.canManage;
  const managerBabyDoc = managerBabyQuery.data === FORBIDDEN ? null : managerBabyQuery.data;
  const managerBaby = managerBabyDoc ? managerDocToBabyData(managerBabyDoc) : null;
  const birthJourney = managerBabyDoc?.birthJourney ?? null;

  const currentStatus = getCurrentStatus(baby);

  return (
    <div {...stylex.props(styles.page)}>
      <HomepageDemoToast publicId={babyDoc.publicId} />

      {canManage && birthJourney && managerBaby ? (
        <OnboardingHost
          surface="baby"
          onboarding={loaderData.onboarding}
          enabled={undefined}
          spotlight={!shareOpen && !postUpdateOpen && !settingsOpen && !photoOpen}
        />
      ) : null}

      {canManage && birthJourney && managerBaby ? (
        <ScheduledNotificationToast
          notifications={loaderData.scheduledNotifications}
          subscriptionCount={loaderData.subscriptionCount}
        />
      ) : null}

      {/* Page chrome: brand pill left, action dock right. Scrolls with the page. */}
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.headerInner)}>
          <Link to="/" {...stylex.props(styles.brandChip)}>
            <span {...stylex.props(styles.brandIcon)}>
              <Baby size={16} />
            </span>
            <span {...stylex.props(styles.brandName)}>isbabyoutyet</span>
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
          />
        </div>
      </header>

      <main {...stylex.props(styles.main)}>
        <h1 {...stylex.props(styles.title)}>{t("Is {{name}} out yet?", { name: baby.name })}</h1>

        {/* Split layout: sticky status card on the left, feed on the right.
            No internal scroll on the card — that steals wheel/trackpad from the page. */}
        <div {...stylex.props(styles.layout)}>
          <section {...stylex.props(styles.statusCard)}>
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
            <div {...stylex.props(styles.centerRow)}>
              <NotificationSubscribe
                babyId={babyDoc._id}
                vapidPublicKey={loaderData.vapidPublicKey}
                browserPush={loaderData.browserPush}
              />
            </div>
            <div {...stylex.props(styles.progressWrap)}>
              <ProgressIndicator baby={baby} currentStatus={currentStatus} />
            </div>
          </section>

          {/* Timeline: owner updates interleaved with encouragements. The
              visitor's encouragement form sits above the feed so nobody has
              to scroll past every message to post; the owner posts via the
              "Post update" button in the dock. */}
          <div {...stylex.props(styles.feedColumn)}>
            <section
              {...stylex.props(styles.encouragementCard)}
              data-tour-id="learn_encouragements"
            >
              <EncouragementForm babyId={babyDoc._id} babyName={baby.name} />
            </section>

            <section {...stylex.props(styles.timelineCard)}>
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

      <footer {...stylex.props(styles.footer)}>
        <Link to="/" {...stylex.props(styles.footerLink)}>
          {t("Having a baby? Are people messaging you non-stop? Create your own page →")}
        </Link>
      </footer>

      <Outlet />
    </div>
  );
}
