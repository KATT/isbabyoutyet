import { Button } from "@workspace/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { allKeyed } from "@workspace/query-prefetch";
import type { InitiatedConvexQuery, PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { Baby as BabyIcon, Plus, User } from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { BirthJourney } from "@workspace/convex/src/types";
import { DashboardBabyCard } from "@/components/baby/dashboard-baby-card";
import { OnboardingHost } from "@/components/onboarding/onboarding-host";
import { api } from "@workspace/convex/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { openOverlayLink } from "@/lib/overlay-nav";

export const Route = createFileRoute("/_auth/dashboard/")({
  component: DashboardIndexPage,
  loader: async (opts) => {
    const preloader = opts.context.convexPreloader;
    return await allKeyed({
      babies: preloader.ensureQueryData(api.baby.listByUser, {}),
      onboarding: preloader.ensureQueryData(api.onboarding.getMine, {}),
    });
  },
});

export type DashboardLoaderData = {
  babies:
    | PreloadedConvexQuery<typeof api.baby.listByUser>
    | InitiatedConvexQuery<typeof api.baby.listByUser>;
  onboarding:
    | PreloadedConvexQuery<typeof api.onboarding.getMine>
    | InitiatedConvexQuery<typeof api.onboarding.getMine>;
};

function DashboardIndexPage() {
  const loaderData = Route.useLoaderData();
  return <DashboardPage babies={loaderData.babies} onboarding={loaderData.onboarding} />;
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
        surface="dashboard"
        onboarding={props.onboarding}
        enabled={undefined}
        spotlight={undefined}
        babyPublicId={undefined}
        onGoToStep={undefined}
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

  return (
    <header className="sticky top-0 z-20 px-4 pt-3 pb-1">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-full border-2 border-border bg-background/85 py-1.5 pl-2 pr-4 shadow-sm backdrop-blur-md transition-transform hover:-rotate-2"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/15">
            <BabyIcon className="size-4 text-primary" />
          </span>
          <span className="text-sm font-extrabold tracking-tight">isbabyoutyet</span>
        </Link>
        <div className="flex items-center gap-1 rounded-full border-2 border-border bg-background/85 p-1 shadow-sm backdrop-blur-md">
          <Button
            size="sm"
            className="rounded-full font-bold"
            render={<Link to="/dashboard/add" />}
            nativeButton={false}
          >
            <Plus data-icon="inline-start" />
            {t("Add Baby")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            render={<Link {...openOverlayLink({ to: "/dashboard/settings" })} />}
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
      <div className="mx-auto max-w-xl rounded-[2rem] border-2 border-dashed border-border bg-card/60 py-14 text-center">
        <p className="text-5xl" aria-hidden="true">
          🍼
        </p>
        <h3 className="mt-4 text-2xl font-black text-foreground">{t("No babies added yet")}</h3>
        <p className="mx-auto mt-2 max-w-md font-medium text-muted-foreground">
          {t("Get started by adding your first baby to track their journey")}
        </p>
        <Button
          size="lg"
          className="mt-6 rounded-full font-extrabold pop-shadow"
          render={<Link to="/dashboard/add" />}
          nativeButton={false}
          data-tour-id="add_baby"
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
          key={baby._id}
          baby={baby}
          index={index}
          dataTourId={props.tourBabyPublicId === baby.publicId ? "tour_baby" : undefined}
        />
      ))}
    </div>
  );
}
