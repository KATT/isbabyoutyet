import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { AppHeader } from "@/components/baby/app-header";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Baby as BabyIcon, Plus, LogOut, ChevronRight } from "lucide-react";
import { api } from "@workspace/convex/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/dashboard/")({
  component: DashboardPage,
  loader: async (opts) => {
    return {
      babies: await opts.context.convexClient.query(api.baby.listByUser, {}),
    };
  },
});

function DashboardPage() {
  const loaderData = Route.useLoaderData();
  let babies = useQuery(api.baby.listByUser, {});
  if (!babies || babies.length === 0) {
    babies = loaderData.babies;
  }

  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button
            size="sm"
            variant="outline"
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
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </AppHeader>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Your babies
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track and manage all your babies' journeys
            </p>
          </div>
          <Button render={<Link to="/dashboard/add" preload="viewport" />} nativeButton={false}>
            <Plus className="w-4 h-4" />
            Add Baby
          </Button>
        </div>

        {babies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-14 text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <BabyIcon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No babies added yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Get started by adding your first baby to track their journey
            </p>
            <Button
              className="mt-5"
              render={<Link to="/dashboard/add" preload="viewport" />}
              nativeButton={false}
            >
              <Plus className="w-4 h-4" />
              Add Your First Baby
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card">
            {babies.map((baby) => {
              const dueDate = new Date(baby.dueDate);
              const now = new Date();
              const daysUntilDue = Math.ceil(
                (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
              );
              const isOverdue = daysUntilDue < 0;

              return (
                <Link
                  key={baby._id}
                  to="/baby/$publicId"
                  params={{ publicId: baby.publicId }}
                  preload="viewport"
                  className="group flex items-center gap-4 p-4 transition-colors hover:bg-muted/40 md:p-5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <BabyIcon className="h-5 w-5 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-foreground">{baby.name}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Due {format(dueDate, "MMMM d, yyyy")}
                    </p>
                  </div>
                  {isOverdue ? (
                    <Badge>
                      {Math.abs(daysUntilDue)} {Math.abs(daysUntilDue) === 1 ? "day" : "days"}{" "}
                      overdue
                    </Badge>
                  ) : daysUntilDue === 0 ? (
                    <Badge>Due today!</Badge>
                  ) : (
                    <Badge variant="outline" className="border-primary/20 bg-primary/5">
                      {daysUntilDue} {daysUntilDue === 1 ? "day" : "days"} left
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
