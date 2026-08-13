import { useEffect } from "react";
import { Button } from "@workspace/ui/components/button";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Baby as BabyIcon, Plus, SignOut } from "@phosphor-icons/react";
import { DashboardBabyCard } from "@/components/baby/dashboard-baby-card";
import { api } from "@workspace/convex/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { LanguageSettings } from "@/components/language-settings";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/dashboard/")({
  component: DashboardPage,
  loader: async (opts) => {
    return {
      babies: await opts.context.convexClient.query(api.baby.listByUser, {}),
    };
  },
});

function DashboardPage() {
  const { t } = useI18n();
  const loaderData = Route.useLoaderData();
  let babies = useQuery(api.baby.listByUser, {});
  if (!babies || babies.length === 0) {
    babies = loaderData.babies;
  }

  const claimInvites = useMutation(api.coParents.claimPendingInvites);
  useEffect(() => {
    void claimInvites({});
  }, [claimInvites]);

  const router = useRouter();

  return (
    <div className="min-h-screen bg-background bg-dots">
      {/* Floating header */}
      <header className="sticky top-0 z-20 px-4 pt-3 pb-1">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-full border-2 border-border bg-background/85 py-1.5 pl-2 pr-4 backdrop-blur-md shadow-sm transition-transform hover:-rotate-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
              <BabyIcon className="h-4 w-4 text-primary" />
            </span>
            <span className="text-sm font-extrabold tracking-tight">isbabyoutyet</span>
          </Link>
          <div className="flex items-center gap-1 rounded-full border-2 border-border bg-background/85 p-1 backdrop-blur-md shadow-sm">
            <Button
              size="sm"
              className="rounded-full font-bold"
              render={<Link to="/dashboard/add" preload="viewport" />}
              nativeButton={false}
            >
              <Plus className="w-4 h-4" />
              {t("Add Baby")}
            </Button>
            <LanguageSettings />
            <ModeToggle className="rounded-full" />
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full font-bold"
              onClick={async () => {
                await authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      router.navigate({ to: "/" });
                    },
                    onError: (error) => {
                      toast.error(error.error.message);
                    },
                  },
                });
              }}
            >
              <SignOut className="w-4 h-4" />
              {t("Logout")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
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

        {babies.length === 0 ? (
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
              render={<Link to="/dashboard/add" preload="viewport" />}
              nativeButton={false}
            >
              <Plus className="w-4 h-4" />
              {t("Add Your First Baby")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {babies.map((baby, index) => (
              <DashboardBabyCard key={baby._id} baby={baby} index={index} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
