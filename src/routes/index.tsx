import { createFileRoute, Link } from "@tanstack/react-router";
import { Baby, Heart, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      {
        title: "Is Baby Out Yet? - Track Your Baby's Journey",
      },
      {
        name: "description",
        content:
          "Track the progress of labor and birth - know when baby arrives! Share updates with family and friends.",
      },
    ],
  }),
});

function HomePage() {
  const sessionData = useSession();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tight mb-6">
            <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              Is Baby Out Yet?
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Track the progress of labor and birth. Share real-time updates with family and friends.
          </p>
          <div className="flex gap-4 justify-center">
            {sessionData.data ? (
              <Link to="/dashboard">
                <Button size="lg" className="text-lg px-8 py-6">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth/signup">
                  <Button size="lg" className="text-lg px-8 py-6">
                    Get Started
                  </Button>
                </Link>
                <Link to="/auth/login">
                  <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-card border rounded-2xl p-8">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4">
              <Baby className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Track Progress</h3>
            <p className="text-muted-foreground">
              Update status as labor progresses - from labor started to baby born. Keep everyone in
              the loop.
            </p>
          </div>

          <div className="bg-card border rounded-2xl p-8">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Share with Family</h3>
            <p className="text-muted-foreground">
              Create a shareable link for each baby. Family and friends can view updates in
              real-time.
            </p>
          </div>

          <div className="bg-card border rounded-2xl p-8">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Due Date Tracking</h3>
            <p className="text-muted-foreground">
              Set a due date and see how many days remain. Get notified when baby is overdue.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-card border rounded-2xl p-8 md:p-12 mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-8 text-center">How It Works</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                1
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Sign Up</h3>
                <p className="text-muted-foreground">
                  Create a free account to start tracking your baby's journey.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                2
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Add Your Baby</h3>
                <p className="text-muted-foreground">
                  Add your baby's name and due date to create a tracking page.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                3
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Share the Link</h3>
                <p className="text-muted-foreground">
                  Share the unique link with family and friends so they can follow along.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                4
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Update Status</h3>
                <p className="text-muted-foreground">
                  Update the status as things progress - labor started, gone to hospital, baby born!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Heart className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-8">
            {sessionData.data
              ? "Continue tracking your baby's journey."
              : "Join families tracking their baby's journey today."}
          </p>
          {sessionData.data ? (
            <Link to="/dashboard">
              <Button size="lg" className="text-lg px-8 py-6">
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/auth/signup">
              <Button size="lg" className="text-lg px-8 py-6">
                Create Your Account
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
