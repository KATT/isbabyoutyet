import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Baby,
  Calendar,
  CheckCircle,
  Github,
  Heart,
  Hospital,
  Sparkles,
  Users,
} from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";

// Static date snapshot for SSR/hydration
// This ensures the same date is used on both server and client during hydration
const SERVER_DATE_SNAPSHOT = "2026-01-01T10:30:00.000Z";

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
          "Keep your family and friends updated as your baby arrives. Completely free, no ads - just a simple way to share the journey.",
      },
    ],
  }),
});

function useCurrentDate() {
  const clientDate = useMemo(() => new Date().toISOString(), []);
  return useSyncExternalStore<string>(
    () => () => {}, // No-op subscribe for demo dates
    () => clientDate, // Client snapshot (cached)
    () => SERVER_DATE_SNAPSHOT, // Server snapshot for SSR/hydration
  );
}

function HomePage() {
  const sessionData = authClient.useSession();

  const currentDate = useCurrentDate();

  // Helper to calculate dates with offsets for realistic demo scenarios
  const hoursAgo = (hoursAgo: number) => {
    const date = new Date(currentDate);
    date.setTime(date.getTime() - hoursAgo * 60 * 60 * 1000);
    return date.toISOString();
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Gradient Background Elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-20 md:py-32 space-y-12">
        {/* Hero Section */}
        <div className="text-center">
          <Badge
            variant="outline"
            className="mb-6 border-primary/20 bg-primary/5 text-primary backdrop-blur-sm"
          >
            <Sparkles className="w-3 h-3 mr-1.5" />
            Keep everyone in the loop
          </Badge>
          <h1 className="text-6xl md:text-8xl font-black text-foreground tracking-tight mb-8 leading-none">
            <span className="bg-linear-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
              Is Baby Out Yet?
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-6 max-w-3xl mx-auto leading-relaxed">
            Keep your family and friends updated as things progress.
          </p>
          <div className="flex gap-3 justify-center flex-wrap mb-10">
            <Badge variant="secondary" className="text-sm px-4 py-1.5">
              Free
            </Badge>
            <Badge variant="secondary" className="text-sm px-4 py-1.5">
              No Ads
            </Badge>
          </div>
          <div className="flex gap-4 justify-center flex-wrap">
            {sessionData.data ? (
              <Button
                size="lg"
                className="text-lg px-8 py-7 h-auto shadow-lg shadow-primary/20"
                asChild
              >
                <Link to="/dashboard" preload="viewport">
                  Go to Dashboard
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  className="text-lg px-8 py-7 h-auto shadow-lg shadow-primary/20"
                  asChild
                >
                  <Link to="/auth/signup" preload="viewport">
                    Get Started
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-7 h-auto border-2 backdrop-blur-sm bg-background/50"
                  asChild
                >
                  <Link to="/auth/login" preload="viewport">
                    Sign In
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="w-14 h-14 bg-linear-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
                <Baby className="w-7 h-7 text-primary" />
              </div>
              <CardTitle>Track Progress</CardTitle>
              <CardDescription>
                Update your status as things happen - labor started, heading to the hospital, baby's
                here! Everyone stays in the loop.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-14 h-14 bg-linear-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <CardTitle>Share with Family</CardTitle>
              <CardDescription>
                Get a simple link you can share with anyone. They can check in anytime to see what's
                happening - no account needed.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-14 h-14 bg-linear-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
                <Calendar className="w-7 h-7 text-primary" />
              </div>
              <CardTitle>Due Date Tracking</CardTitle>
              <CardDescription>
                Set your due date and see how many days are left. We'll let you know when baby's
                running late.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* See It In Action */}
        <Card>
          <CardHeader>
            <CardTitle>See It In Action</CardTitle>
            <CardDescription>Click any stage below to see how your page will look</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                to="/preview"
                search={{
                  name: "Emma",
                }}
                className="group"
              >
                <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                    <Baby className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Waiting</h3>
                  <p className="text-sm text-muted-foreground">Before labor starts</p>
                </div>
              </Link>

              <Link
                to="/preview"
                search={{
                  name: "Oliver",
                  dueDate: hoursAgo(0),
                  laborStarted: hoursAgo(2), // Labor started 2 hours ago
                }}
                className="group"
              >
                <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Activity className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Labour Started</h3>
                  <p className="text-sm text-muted-foreground">Things are happening!</p>
                </div>
              </Link>

              <Link
                to="/preview"
                search={{
                  name: "Sophia",
                  laborStarted: hoursAgo(4), // Labor started 4 hours ago
                  wentToHospital: hoursAgo(1), // At hospital for 1 hour
                  customMessage: "We're at the hospital! Will update when baby arrives 💕",
                  theme: "bubblegum",
                }}
                className="group"
              >
                <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Hospital className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">At Hospital</h3>
                  <p className="text-sm text-muted-foreground">Almost there!</p>
                </div>
              </Link>

              <Link
                to="/preview"
                search={{
                  name: "Liam",
                  laborStarted: hoursAgo(6), // Labor started 6 hours ago
                  wentToHospital: hoursAgo(3), // At hospital for 3 hours
                  babyBorn: hoursAgo(0.5), // Baby born 30 minutes ago
                  babyBornMessage: "Welcome to the world, little one! 🎉",
                  theme: "violet-bloom",
                }}
                className="group"
              >
                <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <CheckCircle className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Baby Born!</h3>
                  <p className="text-sm text-muted-foreground">Celebrate the arrival</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>
              Super simple - you'll be up and running in just a few minutes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  step: "1",
                  title: "Sign Up",
                  description: "Create your free account",
                },
                {
                  step: "2",
                  title: "Add Your Baby",
                  description:
                    "Tell us your baby's name and due date, and we'll create a page for you.",
                },
                {
                  step: "3",
                  title: "Share the Link",
                  description:
                    "Send the link to whoever you want - family, friends, whoever's waiting for updates.",
                },
                {
                  step: "4",
                  title: "Update Status",
                  description:
                    "As things happen, just update your status - labor started, at the hospital, baby's here!",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4 group">
                  <div className="shrink-0 w-12 h-12 bg-linear-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/20 mb-6">
            <Heart className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-4xl font-bold text-foreground mb-4">Ready to get started?</h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            {sessionData.data
              ? "Head back to your dashboard to keep everyone updated."
              : "Join other families sharing their journey. It only takes a minute to set up."}
          </p>
          {sessionData.data ? (
            <Button size="lg" asChild>
              <Link to="/dashboard" preload="viewport">
                Go to Dashboard
              </Link>
            </Button>
          ) : (
            <Button size="lg" asChild>
              <Link to="/auth/signup" preload="viewport">
                Get Started Free
              </Link>
            </Button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-border/50">
          <a
            href="https://github.com/KATT/isbabyoutyet"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="w-5 h-5" />
            <span>Want to contribute? Check out the project on GitHub</span>
          </a>
        </div>
      </div>
    </div>
  );
}
