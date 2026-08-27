import * as stylex from "@stylexjs/stylex";
import { Button } from "@workspace/ui/components/button";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { allKeyed } from "@workspace/query-prefetch";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { Baby as BabyIcon, Plus, User } from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { BirthJourney } from "@workspace/convex/src/types";
import { DashboardBabyCard } from "@/components/baby/dashboard-baby-card";
import { OnboardingHost } from "@/components/onboarding/onboarding-host";
import { api } from "@workspace/convex/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useDashboardSettingsOverlayNav } from "@/lib/overlay-nav";

const styles = stylex.create({
  page: {
    display: "flex",
    minHeight: "100vh",
    flexDirection: "column",
    backgroundColor: colors.background,
    backgroundImage: `radial-gradient(color-mix(in oklab, ${colors.border} 80%, transparent) 1.5px, transparent 1.5px)`,
    backgroundSize: "22px 22px",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    paddingInline: spacing.s4,
    paddingTop: spacing.s3,
    paddingBottom: spacing.s1,
  },
  headerInner: {
    marginInline: "auto",
    display: "flex",
    maxWidth: "64rem",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.s2,
  },
  brandLink: {
    display: "flex",
    alignItems: "center",
    gap: spacing.s2,
    borderRadius: "9999px",
    backgroundColor: `color-mix(in oklab, ${colors.background} 85%, transparent)`,
    paddingBlock: spacing.s1_5,
    paddingLeft: spacing.s2,
    paddingRight: spacing.s4,
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    backdropFilter: "blur(12px)",
    textDecoration: "none",
    transition: "transform 0.15s ease",
    ":hover": {
      transform: "rotate(-2deg)",
    },
  },
  brandMark: {
    display: "flex",
    width: "1.75rem",
    height: "1.75rem",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "9999px",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    color: colors.primary,
  },
  brandName: {
    fontSize: "0.875rem",
    fontWeight: 800,
    letterSpacing: "-0.025em",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: spacing.s1,
    borderRadius: "9999px",
    backgroundColor: `color-mix(in oklab, ${colors.background} 85%, transparent)`,
    padding: spacing.s1,
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    backdropFilter: "blur(12px)",
  },
  main: {
    marginInline: "auto",
    width: "100%",
    maxWidth: "64rem",
    flexGrow: 1,
    paddingInline: spacing.s6,
    paddingBlock: spacing.s10,
  },
  intro: {
    marginBottom: spacing.s10,
    textAlign: "center",
  },
  title: {
    margin: 0,
    fontSize: {
      default: "2.25rem",
      "@media (min-width: 768px)": "3rem",
    },
    fontWeight: 900,
    letterSpacing: "-0.025em",
    color: colors.foreground,
  },
  titleAccent: {
    display: "inline-block",
    transform: "rotate(-1deg)",
    borderRadius: "1rem",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    paddingInline: spacing.s3,
    color: colors.primary,
  },
  empty: {
    marginInline: "auto",
    maxWidth: "36rem",
    borderRadius: "2rem",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: `color-mix(in oklab, ${colors.card} 60%, transparent)`,
    paddingBlock: "3.5rem",
    textAlign: "center",
  },
  emptyEmoji: {
    margin: 0,
    fontSize: "3rem",
    lineHeight: 1,
  },
  emptyCta: {
    marginTop: spacing.s6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: {
      default: "1fr",
      "@media (min-width: 768px)": "repeat(2, minmax(0, 1fr))",
      "@media (min-width: 1024px)": "repeat(3, minmax(0, 1fr))",
    },
    gap: spacing.s5,
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
        <div {...stylex.props(styles.intro)}>
          <Stack gap="s2" align="center">
            <h1 {...stylex.props(styles.title)}>
              {t("Your")} <span {...stylex.props(styles.titleAccent)}>{t("babies")}</span> 👶
            </h1>
            <Text weight="semibold" tone="muted">
              {t("Track and manage all your babies' journeys")}
            </Text>
          </Stack>
        </div>

        <DashboardBabyList babies={babies} tourBabyPublicId={progress.tourBaby?.publicId} />
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
        <Link to="/" {...stylex.props(styles.brandLink)}>
          <span {...stylex.props(styles.brandMark)}>
            <BabyIcon size={16} />
          </span>
          <span {...stylex.props(styles.brandName)}>isbabyoutyet</span>
        </Link>
        <div {...stylex.props(styles.headerActions)}>
          <Button size="sm" shape="pill" render={<Link to="/dashboard/add" />} nativeButton={false}>
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
      <div {...stylex.props(styles.empty)}>
        <Stack gap="s4" align="center">
          <p {...stylex.props(styles.emptyEmoji)} aria-hidden="true">
            🍼
          </p>
          <Stack gap="s2" align="center">
            <Text as="h3" size="2xl" weight="black">
              {t("No babies added yet")}
            </Text>
            <Text tone="muted" weight="medium" align="center">
              {t("Get started by adding your first baby to track their journey")}
            </Text>
          </Stack>
          <div {...stylex.props(styles.emptyCta)}>
            <Button
              size="lg"
              shape="pill"
              render={<Link to="/dashboard/add" />}
              nativeButton={false}
              data-tour-id="add_baby"
            >
              <Plus size={16} />
              {t("Add Your First Baby")}
            </Button>
          </div>
        </Stack>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.grid)}>
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
