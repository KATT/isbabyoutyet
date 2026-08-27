import * as stylex from "@stylexjs/stylex";
import { Button } from "@workspace/ui/components/button";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { allKeyed } from "@workspace/query-prefetch";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { Baby as BabyIcon, Plus, User } from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { BirthJourney } from "@workspace/convex/src/types";
import { Inline } from "@workspace/ui-patterns/components/inline";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { colors, radius, spacing } from "@workspace/ui/lib/tokens.stylex";
import { DashboardBabyCard } from "@/components/baby/dashboard-baby-card";
import { OnboardingHost } from "@/components/onboarding/onboarding-host";
import { api } from "@workspace/convex/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useDashboardSettingsOverlayNav } from "@/lib/overlay-nav";

const styles = stylex.create({
  page: {
    backgroundColor: colors.background,
    backgroundImage: `radial-gradient(color-mix(in oklab, ${colors.border} 80%, transparent) 1.5px, transparent 1.5px)`,
    backgroundSize: "22px 22px",
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },
  header: {
    paddingBottom: spacing.s1,
    paddingInline: spacing.s4,
    paddingTop: spacing.s3,
    position: "sticky",
    top: 0,
    zIndex: 20,
  },
  headerInner: {
    marginInline: "auto",
    maxWidth: "64rem",
    width: "100%",
  },
  brandLink: {
    alignItems: "center",
    backdropFilter: "blur(12px)",
    backgroundColor: `color-mix(in oklab, ${colors.background} 85%, transparent)`,
    borderRadius: "9999px",
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    display: "flex",
    gap: spacing.s2,
    paddingBlock: spacing.s1_5,
    paddingInlineEnd: spacing.s4,
    paddingInlineStart: spacing.s2,
    textDecoration: "none",
    transition: "transform 0.15s ease",
    ":hover": {
      transform: "rotate(-2deg)",
    },
  },
  brandMark: {
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
  headerActions: {
    alignItems: "center",
    backdropFilter: "blur(12px)",
    backgroundColor: `color-mix(in oklab, ${colors.background} 85%, transparent)`,
    borderRadius: "9999px",
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    display: "flex",
    gap: spacing.s1,
    padding: spacing.s1,
  },
  main: {
    flex: 1,
    marginInline: "auto",
    maxWidth: "64rem",
    paddingBlock: spacing.s10,
    paddingInline: spacing.s6,
    width: "100%",
  },
  title: {
    color: colors.foreground,
    fontSize: {
      default: "2.25rem",
      "@media (min-width: 768px)": "3rem",
    },
    fontWeight: 900,
    letterSpacing: "-0.025em",
    lineHeight: 1.1,
    margin: 0,
    textAlign: "center",
  },
  titleAccent: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    borderRadius: radius.xl,
    color: colors.primary,
    display: "inline-block",
    paddingInline: spacing.s3,
    transform: "rotate(-1deg)",
  },
  emptyState: {
    backgroundColor: `color-mix(in oklab, ${colors.card} 60%, transparent)`,
    borderColor: colors.border,
    borderRadius: "2rem",
    borderStyle: "dashed",
    borderWidth: "2px",
    marginInline: "auto",
    maxWidth: "36rem",
    paddingBlock: spacing.s12,
    textAlign: "center",
  },
  emptyEmoji: {
    fontSize: "3rem",
    lineHeight: 1,
    margin: 0,
  },
  emptyCta: {
    display: "flex",
    justifyContent: "center",
  },
  babyGrid: {
    display: "grid",
    gap: spacing.s5,
    gridTemplateColumns: {
      default: "1fr",
      "@media (min-width: 768px)": "repeat(2, minmax(0, 1fr))",
      "@media (min-width: 1024px)": "repeat(3, minmax(0, 1fr))",
    },
  },
});

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPageLayout,
  loader: async (opts) => {
    const preloader = opts.context.convexPreloader;
    return await allKeyed({
      babies: preloader.ensureQueryData(api.baby.listByUser, {}),
      onboarding: preloader.ensureQueryData(api.onboarding.getMine, {}),
    });
  },
});

export type DashboardLoaderData = {
  babies: PreloadedConvexQuery<typeof api.baby.listByUser>;
  onboarding: PreloadedConvexQuery<typeof api.onboarding.getMine>;
};

export function DashboardPageLayout() {
  const loaderData = Route.useLoaderData();
  return (
    <>
      <DashboardPage babies={loaderData.babies} onboarding={loaderData.onboarding} />
      <Outlet />
    </>
  );
}

export function DashboardPage(props: DashboardLoaderData) {
  const { t } = useI18n();
  const babiesQuery = usePreloadedConvexQuery(api.baby.listByUser, props.babies);
  const onboardingQuery = usePreloadedConvexQuery(api.onboarding.getMine, props.onboarding);
  const babies = babiesQuery.data;
  const progress = onboardingQuery.data;

  return (
    <div {...stylex.props(styles.page)}>
      <OnboardingHost
        surface="dashboard"
        onboarding={props.onboarding}
        enabled={undefined}
        spotlight={undefined}
      />
      <DashboardHeader />

      <main {...stylex.props(styles.main)}>
        <Stack gap="s10" fullWidth>
          <Stack gap="s2" align="center" fullWidth>
            <h1 {...stylex.props(styles.title)}>
              {t("Your")} <span {...stylex.props(styles.titleAccent)}>{t("babies")}</span> 👶
            </h1>
            <Text tone="muted" weight="semibold" align="center">
              {t("Track and manage all your babies' journeys")}
            </Text>
          </Stack>

          <DashboardBabyList babies={babies} tourBabyPublicId={progress.tourBaby?.publicId} />
        </Stack>
      </main>
    </div>
  );
}

export function DashboardHeader() {
  const { t } = useI18n();
  const settings = useDashboardSettingsOverlayNav();

  return (
    <header {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.headerInner)}>
        <Inline gap="s2" align="center" justify="between" wrap={false} fullWidth>
          <Link to="/" {...stylex.props(styles.brandLink)}>
            <span {...stylex.props(styles.brandMark)}>
              <BabyIcon size={16} />
            </span>
            <span {...stylex.props(styles.brandName)}>isbabyoutyet</span>
          </Link>
          <div {...stylex.props(styles.headerActions)}>
            <Button
              size="sm"
              shape="pill"
              render={<Link to="/dashboard/add" />}
              nativeButton={false}
            >
              <Plus data-icon="inline-start" />
              {t("Add Baby")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              shape="pill"
              render={<Link {...settings.openLink} />}
              nativeButton={false}
              aria-label={t("Settings")}
            >
              <Avatar size="sm">
                <AvatarFallback>
                  <User />
                </AvatarFallback>
              </Avatar>
            </Button>
          </div>
        </Inline>
      </div>
    </header>
  );
}

type DashboardBaby = {
  _id: Id<"baby">;
  name: string;
  publicId: string;
  dueDate: string | null;
  dueDateDisplayMode: "exact" | "message";
  publicDueDateText: string | null;
  role: "owner" | "coParent";
  timeZone: string;
} & Partial<{
  laborStarted: string | null;
  wentToHospital: string | null;
  babyBorn: string | null;
  birthJourney: BirthJourney;
}>;

export function DashboardBabyList(props: {
  babies: DashboardBaby[];
  tourBabyPublicId: string | undefined;
}) {
  const { t } = useI18n();

  if (props.babies.length === 0) {
    return (
      <div {...stylex.props(styles.emptyState)}>
        <Stack gap="s4" align="center">
          <p {...stylex.props(styles.emptyEmoji)} aria-hidden="true">
            🍼
          </p>
          <Text as="h3" size="2xl" weight="black">
            {t("No babies added yet")}
          </Text>
          <Text tone="muted" weight="medium" align="center">
            {t("Get started by adding your first baby to track their journey")}
          </Text>
          <div {...stylex.props(styles.emptyCta)}>
            <Button
              size="lg"
              shape="pill"
              render={<Link to="/dashboard/add" />}
              nativeButton={false}
              data-tour-id="add_baby"
            >
              <Plus data-icon="inline-start" />
              {t("Add Your First Baby")}
            </Button>
          </div>
        </Stack>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.babyGrid)}>
      {props.babies.map((baby, index) => (
        <DashboardBabyCard
          key={baby._id}
          baby={baby}
          index={index}
          dataTourId={props.tourBabyPublicId === baby.publicId ? "tour_baby" : undefined}
        />
      ))}
    </div>
  );
}
