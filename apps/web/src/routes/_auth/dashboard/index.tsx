import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { ArrowRight, Baby as BabyIcon, CalendarHeart, Plus, SignOut } from "@phosphor-icons/react";
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
              Add Baby
            </Button>
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
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black tracking-tight text-foreground md:text-5xl">
            Your{" "}
            <span className="inline-block -rotate-1 rounded-2xl bg-primary/15 px-3 text-primary">
              babies
            </span>{" "}
            👶
          </h1>
          <p className="mt-2 font-semibold text-muted-foreground">
            Track and manage all your babies' journeys
          </p>
        </div>

        {babies.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-[2rem] border-2 border-dashed border-border bg-card/60 py-14 text-center">
            <p className="text-5xl" aria-hidden="true">
              🍼
            </p>
            <h3 className="mt-4 text-2xl font-black text-foreground">No babies added yet</h3>
            <p className="mx-auto mt-2 max-w-md font-medium text-muted-foreground">
              Get started by adding your first baby to track their journey
            </p>
            <Button
              size="lg"
              className="mt-6 rounded-full font-extrabold pop-shadow"
              render={<Link to="/dashboard/add" preload="viewport" />}
              nativeButton={false}
            >
              <Plus className="w-4 h-4" />
              Add Your First Baby
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {babies.map((baby, index) => {
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
                  <div
                    className={`flex h-full flex-col rounded-3xl border-2 border-border bg-card p-6 pop-shadow transition-transform group-hover:-translate-y-1 ${
                      index % 2 === 0 ? "group-hover:-rotate-1" : "group-hover:rotate-1"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/25 bg-primary/10 text-xl">
                        👶
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <h2 className="mt-4 text-2xl font-black tracking-tight text-foreground">
                      {baby.name}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                      <CalendarHeart className="h-3.5 w-3.5" />
                      Due {format(dueDate, "MMMM d, yyyy")}
                    </p>
                    <div className="mt-4">
                      {isOverdue ? (
                        <Badge className="rounded-full font-bold">
                          {Math.abs(daysUntilDue)} {Math.abs(daysUntilDue) === 1 ? "day" : "days"}{" "}
                          overdue
                        </Badge>
                      ) : daysUntilDue === 0 ? (
                        <Badge className="rounded-full font-bold">Due today!</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="rounded-full border-2 border-primary/20 bg-primary/5 font-bold"
                        >
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
