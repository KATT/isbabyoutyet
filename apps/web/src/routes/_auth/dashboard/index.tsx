import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { PageHeader } from "@/components/baby/page-header";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Baby as BabyIcon, Plus, LogOut, Calendar, ArrowRight } from "lucide-react";
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
      <PageHeader>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            render={<Link to="/dashboard/add" preload="viewport" />}
            nativeButton={false}
          >
            <Plus className="w-4 h-4" />
            Add Baby
          </Button>
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
      </PageHeader>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Dashboard
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold italic tracking-tight text-foreground md:text-5xl">
            Your babies
          </h1>
          <p className="mt-2 text-muted-foreground">Track and manage all your babies' journeys</p>
        </div>

        {babies.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border py-16 text-center">
            <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
              <BabyIcon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-serif text-2xl font-semibold text-foreground">
              No babies added yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Get started by adding your first baby to track their journey
            </p>
            <Button
              size="lg"
              className="mt-6 shadow-md shadow-primary/20"
              render={<Link to="/dashboard/add" preload="viewport" />}
              nativeButton={false}
            >
              <Plus className="w-4 h-4" />
              Add Your First Baby
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
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
                  className="group"
                >
                  <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/15">
                        <BabyIcon className="h-5 w-5 text-primary" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <h2 className="mt-4 font-serif text-2xl font-semibold tracking-tight text-foreground">
                      {baby.name}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Due {format(dueDate, "MMMM d, yyyy")}
                    </p>
                    <div className="mt-4">
                      {isOverdue ? (
                        <Badge className="shadow-sm shadow-primary/20">
                          {Math.abs(daysUntilDue)} {Math.abs(daysUntilDue) === 1 ? "day" : "days"}{" "}
                          overdue
                        </Badge>
                      ) : daysUntilDue === 0 ? (
                        <Badge className="shadow-sm shadow-primary/20">Due today!</Badge>
                      ) : (
                        <Badge variant="outline" className="border-primary/20 bg-primary/5">
                          {daysUntilDue} {daysUntilDue === 1 ? "day" : "days"} until due date
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
