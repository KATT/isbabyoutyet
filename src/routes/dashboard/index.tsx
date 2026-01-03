import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Baby, Plus } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: session } = useSession();
  const babies = useQuery(api.babies.listByUser);

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground mb-4">Please sign in to view your dashboard</p>
          <Link to="/auth/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (babies === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-foreground">Your Babies</h1>
          <Link to="/dashboard/add">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Baby
            </Button>
          </Link>
        </div>

        {babies.length === 0 ? (
          <div className="bg-card border rounded-2xl p-12 text-center">
            <p className="text-foreground text-lg mb-4">No babies added yet</p>
            <Link to="/dashboard/add">
              <Button>Add Your First Baby</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {babies.map(
              (baby: {
                _id: string;
                name: string;
                dueDate: string;
                publicId: string;
                createdAt: number;
              }) => {
                const dueDate = new Date(baby.dueDate);
                const now = new Date();
                const daysUntilDue = Math.ceil(
                  (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                );
                const isOverdue = daysUntilDue < 0;

                return (
                  <Link key={baby._id} to="/baby/$publicId" params={{ publicId: baby.publicId }}>
                    <Card className="hover:bg-accent transition-colors cursor-pointer">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/20 rounded-lg">
                            <Baby className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <CardTitle>{baby.name}</CardTitle>
                            <CardDescription>
                              Due: {format(dueDate, "MMMM d, yyyy")}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isOverdue ? (
                          <div className="text-primary font-semibold">
                            {Math.abs(daysUntilDue)} {Math.abs(daysUntilDue) === 1 ? "day" : "days"}{" "}
                            overdue
                          </div>
                        ) : daysUntilDue === 0 ? (
                          <div className="text-primary font-semibold">Due today!</div>
                        ) : (
                          <div className="text-muted-foreground">
                            {daysUntilDue} {daysUntilDue === 1 ? "day" : "days"} until due date
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              },
            )}
          </div>
        )}
      </div>
    </div>
  );
}
