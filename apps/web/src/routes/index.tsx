import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Baby,
  Bell,
  Calendar,
  CheckCircle,
  Heart,
  Hospital,
  Link2,
  MessageCircleHeart,
  Palette,
  Sparkles,
} from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { getDetectedLocale, translate, useI18n } from "@/lib/i18n";

// Static date snapshot for SSR/hydration
// This ensures the same date is used on both server and client during hydration
const SERVER_DATE_SNAPSHOT = "2026-01-01T10:30:00.000Z";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => {
    const locale = getDetectedLocale();
    const title = translate(locale, "Is Baby Out Yet? – Share Your Baby's Arrival");
    const description = translate(
      locale,
      "Stop answering 'any news yet?' texts. Create a simple page to keep everyone updated, let them send encouragement, and notify them the moment baby arrives.",
    );
    return {
      meta: [
        {
          title,
        },
        {
          name: "description",
          content: description,
        },
        {
          property: "og:title",
          content: title,
        },
        {
          property: "og:description",
          content: description,
        },
        {
          name: "twitter:title",
          content: title,
        },
        {
          name: "twitter:description",
          content: description,
        },
      ],
      links: [{ rel: "canonical", href: "https://isbabyoutyet.com/" }],
    };
  },
});

// lucide-react v1 removed brand icons (including Github), so inline the mark
function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function useCurrentDate() {
  const clientDate = useMemo(() => new Date().toISOString(), []);
  return useSyncExternalStore<string>(
    () => () => {}, // No-op subscribe for demo dates
    () => clientDate, // Client snapshot (cached)
    () => SERVER_DATE_SNAPSHOT, // Server snapshot for SSR/hydration
  );
}

function HomePage() {
  const { t } = useI18n();
  const sessionData = authClient.useSession();

  const currentDate = useCurrentDate();

  // Helper to calculate dates with offsets for realistic demo scenarios
  const hoursAgo = (hours: number) => {
    const date = new Date(currentDate);
    date.setTime(date.getTime() - hours * 60 * 60 * 1000);
    return date.toISOString();
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Gradient Background Elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-20 md:py-32 space-y-16">
        {/* Hero Section */}
        <div className="text-center">
          <Badge
            variant="outline"
            className="mb-6 border-primary/20 bg-primary/5 text-primary backdrop-blur-sm"
          >
            <Sparkles className="w-3 h-3 mr-1.5" />
            {t("Free forever, no ads")}
          </Badge>
          <h1 className="text-6xl md:text-8xl font-black text-foreground tracking-tight mb-8 leading-none">
            <span className="bg-linear-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
              Is Baby Out Yet?
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            {t(
              'Stop answering "any news yet?" texts. Share one link and let everyone follow along.',
            )}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            {sessionData.data ? (
              <Button
                size="lg"
                className="text-lg px-8 py-7 h-auto shadow-lg shadow-primary/20"
                render={<Link to="/dashboard" preload="viewport" />}
                nativeButton={false}
              >
                {t("Go to Dashboard")}
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  className="text-lg px-8 py-7 h-auto shadow-lg shadow-primary/20"
                  render={<Link to="/auth/signup" preload="viewport" />}
                  nativeButton={false}
                >
                  {t("Get Started")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-7 h-auto border-2 backdrop-blur-sm bg-background/50"
                  render={<Link to="/auth/login" preload="viewport" />}
                  nativeButton={false}
                >
                  {t("Sign In")}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* For You Section */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground mb-2">For You</h2>
            <p className="text-muted-foreground">Everything you need to share the journey</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="w-14 h-14 bg-linear-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
                  <Baby className="w-7 h-7 text-primary" />
                </div>
                <CardTitle>Update Your Status</CardTitle>
                <CardDescription>
                  One tap to update everyone - labour started, at the hospital, baby's here! No
                  group texts, no repeated calls.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-14 h-14 bg-linear-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
                  <Calendar className="w-7 h-7 text-primary" />
                </div>
                <CardTitle>Countdown to Due Date</CardTitle>
                <CardDescription>
                  Set your due date and everyone can see how many days are left. Plus a friendly
                  "overdue" counter when baby takes their time.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-14 h-14 bg-linear-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
                  <Palette className="w-7 h-7 text-primary" />
                </div>
                <CardTitle>Make It Yours</CardTitle>
                <CardDescription>
                  Pick a theme that matches your style. From soft pastels to bold colours - your
                  page, your vibe.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* For Your Visitors Section */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground mb-2">For Your Family & Friends</h2>
            <p className="text-muted-foreground">What everyone you share with gets</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="w-14 h-14 bg-linear-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
                  <Link2 className="w-7 h-7 text-primary" />
                </div>
                <CardTitle>No Account Needed</CardTitle>
                <CardDescription>
                  Anyone with the link can check in anytime. Grandma doesn't need to download an app
                  or create an account.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-14 h-14 bg-linear-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
                  <MessageCircleHeart className="w-7 h-7 text-primary" />
                </div>
                <CardTitle>Send Encouragement</CardTitle>
                <CardDescription>
                  Visitors can leave messages of love and support. Like a digital guestbook filled
                  with well-wishes you'll treasure.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-14 h-14 bg-linear-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
                  <Bell className="w-7 h-7 text-primary" />
                </div>
                <CardTitle>Get Notified</CardTitle>
                <CardDescription>
                  They can subscribe to push notifications and be the first to know the moment baby
                  arrives. No constant page refreshing.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* See It In Action */}
        <Card>
          <CardHeader>
            <CardTitle>See It In Action</CardTitle>
            <CardDescription>Click any stage to see how your page will look</CardDescription>
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
                  <p className="text-sm text-muted-foreground">Before labour starts</p>
                </div>
              </Link>

              <Link
                to="/preview"
                search={{
                  name: "Oliver",
                  dueDate: hoursAgo(0),
                  laborStarted: hoursAgo(2),
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
                  laborStarted: hoursAgo(4),
                  wentToHospital: hoursAgo(1),
                  hospitalMessage: "We're at the hospital! Will update when baby arrives 💕",
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
                  laborStarted: hoursAgo(6),
                  wentToHospital: hoursAgo(3),
                  babyBorn: hoursAgo(0.5),
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
            <CardDescription>Up and running in under a minute</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: "Create Your Page",
                  description: "Sign up and add your baby's name and due date. That's it.",
                },
                {
                  step: "2",
                  title: "Share the Link",
                  description:
                    "Send it to family and friends. They can check in anytime and subscribe for notifications.",
                },
                {
                  step: "3",
                  title: "Update as You Go",
                  description:
                    "When things start happening, update your status. Everyone gets notified automatically.",
                },
              ].map((item) => (
                <div key={item.step} className="flex flex-col items-center text-center group">
                  <div className="shrink-0 w-14 h-14 bg-linear-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.description}</p>
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
          <h2 className="text-4xl font-bold text-foreground mb-4">Ready to share the journey?</h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            {sessionData.data
              ? "Head back to your dashboard to keep everyone updated."
              : "Join families who've already shared their special moments. Takes less than a minute."}
          </p>
          {sessionData.data ? (
            <Button
              size="lg"
              render={<Link to="/dashboard" preload="viewport" />}
              nativeButton={false}
            >
              Go to Dashboard
            </Button>
          ) : (
            <Button
              size="lg"
              render={<Link to="/auth/signup" preload="viewport" />}
              nativeButton={false}
            >
              Get Started Free
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
            <GithubIcon className="w-5 h-5" />
            <span>Open source on GitHub</span>
          </a>
        </div>
      </div>
    </div>
  );
}
