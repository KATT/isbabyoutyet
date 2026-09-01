import { Button } from "@workspace/ui/components/button";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { allKeyed } from "@workspace/query-prefetch";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { Baby as BabyIcon, Plus, User } from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { BirthJourney } from "@workspace/convex/src/types";
import { DashboardBabyCard } from "@/components/baby/dashboard-baby-card";
import { OnboardingHost } from "@/components/onboarding/onboarding-host";
import { api } from "@workspace/convex/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useDashboardSettingsOverlayNav } from "@/lib/overlay-nav";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPageLayout,
  loader: async (opts) => {
    const preloader = opts.context.convexPreloader;
    return await allKeyed({
      babies: preloader.fetchQueryData(api.baby.listByUser, {}),
      onboarding: preloader.fetchQueryData(api.onboarding.getMine, {}),
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
    <div className="flex min-h-screen flex-col bg-background bg-dots">
      <OnboardingHost
        enabled={undefined}
        onboarding={props.onboarding}
        spotlight={undefined}
        surface="dashboard"
      />
      <DashboardHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black tracking-tight text-foreground md:text-5xl">
            {t("Your")}{" "}
            <span className="inline-block -rotate-1 rounded-2xl bg-primary/15 px-3 text-primary">
              {t("babies")}
            </span>{" "}
            👶
          </h1>
          <p className="mt-2 font-semibold text-muted-foreground">
            {t("Track and manage all your babies' journeys")}
          </p>
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
    <header className="sticky top-0 z-20 px-4 pt-3 pb-1">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
        <Link
          className="flex items-center gap-2 rounded-full bg-background/85 py-1.5 pl-2 pr-4 shadow-sm backdrop-blur-md transition-transform hover:-rotate-2"
          to="/"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/15">
            <BabyIcon className="size-4 text-primary" />
          </span>
          <span className="text-sm font-extrabold tracking-tight">isbabyoutyet</span>
        </Link>
        <div className="flex items-center gap-1 rounded-full bg-background/85 p-1 shadow-sm backdrop-blur-md">
          <Button
            className="rounded-full font-bold"
            nativeButton={false}
            render={<Link to="/dashboard/add" />}
            size="sm"
          >
            <Plus data-icon="inline-start" />
            {t("Add Baby")}
          </Button>
          <Button
            aria-label={t("Settings")}
            className="rounded-full"
            nativeButton={false}
            render={<Link {...settings.openLink} />}
            size="icon"
            variant="ghost"
          >
            <Avatar className="after:border-0" size="sm">
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
  dueDate: string | null;
  dueDateDisplayMode: "exact" | "message";
  name: string;
  publicDueDateText: string | null;
  publicId: string;
  role: "owner" | "coParent";
  timeZone: string;
} & Partial<{
  babyBorn: string | null;
  birthJourney: BirthJourney;
  laborStarted: string | null;
  wentToHospital: string | null;
}>;

export function DashboardBabyList(props: {
  babies: Array<DashboardBaby>;
  tourBabyPublicId: string | undefined;
}) {
  const { t } = useI18n();

  if (props.babies.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border-2 border-dashed border-border bg-card/60 py-14 text-center">
        <p aria-hidden="true" className="text-5xl">
          🍼
        </p>
        <h3 className="mt-4 text-2xl font-black text-foreground">{t("No babies added yet")}</h3>
        <p className="mx-auto mt-2 max-w-md font-medium text-muted-foreground">
          {t("Get started by adding your first baby to track their journey")}
        </p>
        <Button
          className="mt-6 rounded-full font-extrabold pop-shadow"
          data-tour-id="add_baby"
          nativeButton={false}
          render={<Link to="/dashboard/add" />}
          size="lg"
        >
          <Plus className="w-4 h-4" />
          {t("Add Your First Baby")}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {props.babies.map((baby, index) => (
        <DashboardBabyCard
          baby={baby}
          dataTourId={props.tourBabyPublicId === baby.publicId ? "tour_baby" : undefined}
          index={index}
          key={baby._id}
        />
      ))}
    </div>
  );
}
