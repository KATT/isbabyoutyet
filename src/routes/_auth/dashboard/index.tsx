import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Baby as BabyIcon, Plus, LogOut, Calendar } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { signOut } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth/dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  const babies = useQuery(api.baby.listByUser, {});
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Gradient Background Elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-5xl font-black text-foreground mb-2 tracking-tight">
              <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                Your Babies
              </span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Track and manage all your baby's journeys
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard/add">
              <Button className="shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" />
                Add Baby
              </Button>
            </Link>
            <ModeToggle />
            <Button
              variant="outline"
              className="border-2 backdrop-blur-sm"
              onClick={async () => {
                await signOut();
                await router.navigate({ to: "/" });
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {!babies ? (
          <Card>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-muted-foreground">Loading...</div>
              </div>
            </CardContent>
          </Card>
        ) : babies.length === 0 ? (
          <Card>
            <CardContent>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/20 mb-6">
                <BabyIcon className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">No babies added yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Get started by adding your first baby to track their journey
              </p>
              <Link to="/dashboard/add">
                <Button size="lg" className="shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Baby
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  className="group"
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-linear-to-br from-primary/20 to-primary/10 rounded-xl border border-primary/20 group-hover:scale-110 transition-transform">
                          <BabyIcon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle>{baby.name}</CardTitle>
                          <CardDescription>
                            <Calendar className="w-3.5 h-3.5" />
                            {format(dueDate, "MMMM d, yyyy")}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isOverdue ? (
                        <Badge
                          variant="default"
                          className="bg-linear-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20"
                        >
                          {Math.abs(daysUntilDue)} {Math.abs(daysUntilDue) === 1 ? "day" : "days"}{" "}
                          overdue
                        </Badge>
                      ) : daysUntilDue === 0 ? (
                        <Badge
                          variant="default"
                          className="bg-linear-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20"
                        >
                          Due today!
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-primary/20 bg-primary/5">
                          {daysUntilDue} {daysUntilDue === 1 ? "day" : "days"} until due date
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
